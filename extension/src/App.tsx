
import { useEffect, useState, useMemo } from 'react';
import './index.css'; // Global Reset
import { Header } from './components/Layout/Header';
// formatRecipient removed
import { DetailView } from './components/activity/DetailView';
import { API_CONFIG } from './config/api';
import { Modal } from './components/common/Modal';

import { LocalStorageService } from './services/LocalStorageService';
import type { TrackedEmail } from './types';
import { AuthService, type UserProfile } from './services/AuthService';

import { DashboardView } from './views/DashboardView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';
import { TabButton } from './components/common/TabButton';

const App = () => {
  const [view, setView] = useState<'dashboard' | 'activity' | 'settings'>('dashboard');
  const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);

  // Data
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null); // Local sender identity
  const [error, setError] = useState<string | null>(null);

  // Auth
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Settings
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [bodyPreviewLength, setBodyPreviewLength] = useState(0); // 0 = disabled

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'opened' | 'sent'>('all');
  const [senderFilter, setSenderFilter] = useState<string>('all');

  // Stats
  const [stats, setStats] = useState({ tracked: 0, opened: 0, rate: 0 });

  // Modal State (Status only - Delete modal is now in SettingsView)
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'danger' | 'info' | 'warning' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // -- EFFECTS --

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleLogin = async () => {
    try {
      const token = await AuthService.getAuthToken(true);
      setAuthToken(token);
      let profile: UserProfile;
      try {
        profile = await AuthService.getUserProfile(token);
        setUserProfile(profile);

        // CRITICAL: Save profile to local storage (more reliable for background access)
        chrome.storage.local.set({ userProfile: profile }, () => {
          console.log('App: Saved userProfile to local storage:', profile);
        });
      } catch (err) {
        throw new Error('Failed to fetch user profile');
      }

      // 1. Conflict Check: Do local emails belong to someone else?
      const localEmails = await LocalStorageService.getEmails();
      const localIds = localEmails.map(e => e.id);

      if (localIds.length > 0) {
        const hasConflict = await AuthService.checkOwnershipConflict(localIds, profile.id);

        if (hasConflict) {
          // ABDICATE: Abort login, force logout
          await AuthService.logout(token);
          setAuthToken(null);
          setUserProfile(null);

          setStatusModal({
            isOpen: true,
            title: 'Account Conflict',
            message: `This device contains tracking history linked to a DIFFERENT account. Please 'Delete All History' before logging in with ${profile.email}, or login with the previous account.`,
            type: 'danger'
          });
          return;
        }
      }

      // 2. Sync User
      await AuthService.syncUser(profile.email, profile.id);

      // 3. Upload Local History (Merge Strategy)
      // Only upload items that haven't been marked as synced yet
      const unsynced = localEmails.filter(e => !e.synced);
      if (unsynced.length > 0) {
        try {
          const count = await AuthService.uploadHistory(unsynced, profile.id, profile.email);
          if (count > 0) {
            // Mark these IDs as synced so we don't re-upload
            await LocalStorageService.markAsSynced(unsynced.map(e => e.id));

            setStatusModal({
              isOpen: true,
              title: 'History Synced',
              message: `Synced ${count} emails to your cloud account.`,
              type: 'success'
            });
          }
        } catch (syncErr) {
          console.warn('History upload failed:', syncErr);
        }
      }

      // 4. Refresh list
      fetchEmails(profile);

    } catch (e) {
      console.error('Login failed', e);
      setStatusModal({
        isOpen: true,
        title: 'Login Failed',
        message: 'Could not sign in. ' + (e instanceof Error ? e.message : ''),
        type: 'danger'
      });
    }
  };

  const handleLogout = async () => {
    if (authToken) {
      // Logout logic: Revoke token but PRESERVE local storage
      await AuthService.logout(authToken);
      setAuthToken(null);
      setUserProfile(null);

      // Refresh list: Should revert to showing Local Storage data
      fetchEmails(null);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Process Pending Deletion Queue (Retry)
      const pending = await LocalStorageService.getPendingDeletes();
      if (pending.length > 0) {
        console.log(`[SYNC] Processing ${pending.length} pending delete requests...`);
        const urlBase = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}`;

        // Try to process all, filter out successful ones
        const remaining: { ids: string[], user?: string }[] = [];

        for (const task of pending) {
          try {
            const params = new URLSearchParams();
            params.append('ids', task.ids.join(','));
            if (task.user) params.append('user', task.user);

            const res = await fetch(`${urlBase}?${params.toString()}`, { method: 'DELETE' });
            if (!res.ok) {
              console.warn('[SYNC] Retry delete failed, keeping in queue', res.status);
              remaining.push(task);
            }
          } catch (e) {
            remaining.push(task); // Keep network errors in queue
          }
        }

        // Update queue
        await LocalStorageService.clearPendingDeletes();
        if (remaining.length > 0) {
          // Re-queue failed ones
          for (const task of remaining) {
            await LocalStorageService.queuePendingDelete(task.ids, task.user);
          }
        } else {
          console.log('[SYNC] All pending deletions processed.');
        }
      }

      const token = await AuthService.getAuthToken(false).catch(() => null);
      if (token) {
        setAuthToken(token);
        const profile = await AuthService.getUserProfile(token);
        setUserProfile(profile);

        // Persistence: Save profile to LOCAL storage for Background Script access
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ userProfile: profile });
        }

        fetchEmails(profile);
      } else {
        fetchEmails(null);
      }
    } catch (e) {
      console.log('Auto-login failed / Not logged in', e);
      fetchEmails(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async (overrideProfile?: UserProfile | null) => {
    setLoading(true);
    setError(null);
    try {
      // Use override profile if provided (during login/logout flow), otherwise current state
      const effectiveProfile = overrideProfile !== undefined ? overrideProfile : userProfile;

      // 1. Load Local History (Incognito)
      const localEmails = await LocalStorageService.getEmails();
      const localIds = localEmails.map(e => e.id);

      // 2. Build Query
      // We increased limit to 1000 to cover recent history

      const params = new URLSearchParams();
      params.append('limit', '1000');
      params.append('t', String(Date.now()));

      if (effectiveProfile) {
        // Authenticated: Use Owner ID (Cloud Mode)
        // We DO NOT filter by user email here, so that ALL aliases/identities linked to this account are shown.
        params.append('ownerId', effectiveProfile.id);
      } else if (currentUser) {
        // Unauthenticated: Filter by Sender Identity (Incognito)
        params.append('user', currentUser);
      }

      // Hybrid: Also ask for stats for our local IDs
      // This ensures that even if I am logged in, if I have local incognito data that ISN'T owned by me (yet), I see stats?
      // Or if I am logged out, I see stats for my local data.
      if (localIds.length > 0) {
        params.append('ids', localIds.join(','));
      }

      // If we have neither user nor local IDs, empty state
      if (!effectiveProfile && !currentUser && localIds.length === 0) {
        setEmails([]);
        setStats({ tracked: 0, opened: 0, rate: 0 });
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}?${params.toString()}`, {
        cache: 'no-store'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const { data } = await res.json();
      const serverEmails: TrackedEmail[] = data || [];

      // 3. MERGE STRATEGY
      const emailMap = new Map<string, TrackedEmail>();

      // Priority 1: Server Data (contains updated Stats + Legacy Metadata)
      // Priority 1: Server Data (contains updated Stats + Legacy Metadata)
      serverEmails.forEach(e => {
        const enriched = {
          ...e,
          openCount: (e as any)._count?.opens ?? e.openCount ?? 0,
          opens: e.opens || []
        };
        emailMap.set(e.id, enriched);

        // HYDRATION: Ensure server data availability in Local Storage for offline/logout access
        // This fixes the "Disappearing emails on logout after reinstall" issue
        LocalStorageService.saveEmail({
          id: enriched.id,
          subject: enriched.subject || '',
          recipient: enriched.recipient || '',
          body: enriched.body || '',
          user: enriched.user || '',
          createdAt: enriched.createdAt,
          // We don't save stats/opens locally as those are dynamic, but we save the core record
        });
      });

      // Priority 2: Local Data (Restores Metadata for Incognito items where Server returns nulls)
      localEmails.forEach(local => {
        const existing = emailMap.get(local.id);
        if (existing) {
          // Hybrid Merge: Keep Server Stats, Restore Local Metadata if Server missing it
          emailMap.set(local.id, {
            ...existing,
            subject: existing.subject || local.subject,
            recipient: existing.recipient || local.recipient,
            body: existing.body || local.body,
            user: existing.user || local.user, // CRITICAL: Preserve sender email
          });
        } else {
          // Local-only item
          emailMap.set(local.id, {
            ...local,
            opens: [],
            openCount: 0,
            createdAt: local.createdAt || new Date().toISOString()
          } as TrackedEmail);
        }
      });

      const mergedList = Array.from(emailMap.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setEmails(mergedList);

      // Stats
      // Use logic-based totals
      const tracked = mergedList.length;
      const opened = mergedList.filter(e => e.openCount > 0).length;
      const rate = tracked > 0 ? Math.round((opened / tracked) * 100) : 0;

      setStats({ tracked, opened, rate });

    } catch (e) {
      console.error('Failed to fetch emails:', e);
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleGlobal = () => {
    const newState = !globalEnabled;
    setGlobalEnabled(newState);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ trackingEnabled: newState });
    }
  };

  const handleBodyPreviewChange = (value: number) => {
    setBodyPreviewLength(value);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ bodyPreviewLength: value });
    }
  };


  const activeIdentity = userProfile ? userProfile.email : currentUser;

  const confirmDeleteHistory = async () => {
    // Check context validity before async
    if (typeof chrome !== 'undefined' && chrome.runtime && !chrome.runtime.id) {
      setStatusModal({
        isOpen: true,
        title: 'Context Invalidated',
        message: 'Extension context invalidated. Please reload the page.',
        type: 'danger'
      });
      return;
    }

    setLoading(true);
    try {
      const urlBase = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}`;
      const params = new URLSearchParams();

      if (userProfile) {
        // --- CLOUD MODE: Delete All for Account ---
        params.append('ownerId', userProfile.id);
        // Also send user email to catch legacy/ghost data if any
        if (userProfile.email) params.append('user', userProfile.email);

        const res = await fetch(`${urlBase}?${params.toString()}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete history on server');

        // Clear ALL local storage to match account wipe
        await LocalStorageService.deleteAll();

      } else {
        // --- INCOGNITO MODE: Delete Local + Specific Server Pixels ---

        let idsToDelete: string[] = [];
        let senderToDelete: string | null = null;
        let serverDeleteSuccess = true;

        if (senderFilter !== 'all') {
          // Case A: Deleting specific sender
          senderToDelete = senderFilter;
          const localEmails = await LocalStorageService.getEmails();
          idsToDelete = localEmails
            .filter(e => e.user === senderToDelete)
            .map(e => e.id);
        } else {
          // Case B: Deleting ALL local history
          const localEmails = await LocalStorageService.getEmails();
          idsToDelete = localEmails.map(e => e.id);
        }

        // 1. Delete Server Data (Pixels) by IDs
        if (idsToDelete.length > 0) {
          params.append('ids', idsToDelete.join(','));
          if (senderToDelete) params.append('user', senderToDelete);

          try {
            const res = await fetch(`${urlBase}?${params.toString()}`, { method: 'DELETE' });
            if (!res.ok) {
              serverDeleteSuccess = false;
              await LocalStorageService.queuePendingDelete(idsToDelete, senderToDelete || undefined);
            }
          } catch (serverErr) {
            serverDeleteSuccess = false;
            console.warn('Server deletion request failed (network), queuing for retry:', serverErr);
            await LocalStorageService.queuePendingDelete(idsToDelete, senderToDelete || undefined);
          }
        }

        // 2. Delete Local Data
        if (senderToDelete) {
          await LocalStorageService.deleteBySender(senderToDelete);
          if (currentUser === senderToDelete) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              await chrome.storage.local.remove(['currentUser']);
            }
            setCurrentUser(null);
          }
        } else {
          await LocalStorageService.deleteAll();
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.remove(['currentUser']);
          }
          setCurrentUser(null);
        }

        // Reset State
        setEmails([]);
        setStats({ tracked: 0, opened: 0, rate: 0 });
        // NOTE: We do not manage Delete Modal state here anymore, it is managed by SettingsView
        loadInitialData();

        setStatusModal({
          isOpen: true,
          title: serverDeleteSuccess ? 'History Deleted' : 'Deleted Locally Only',
          message: serverDeleteSuccess
            ? 'Tracking history has been cleared successfully.'
            : 'History cleared from device. Server was unreachable, so deletion has been QUEUED for automatic retry later.',
          type: serverDeleteSuccess ? 'success' : 'warning'
        });
      }
    } catch (e) {
      setStatusModal({
        isOpen: true,
        title: 'Error',
        message: 'Error clearing history: ' + (e instanceof Error ? e.message : String(e)),
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  // -- COMPUTED DATA --

  // 1. Get Unique Senders for Dropdown - ONLY from actual email data
  const uniqueSenders = useMemo(() => {
    const senders = new Set<string>();
    emails.forEach(e => {
      if (e.user) senders.add(e.user); // Temporarily allow 'Unknown' for debugging
    });
    return Array.from(senders).sort();
  }, [emails]);

  // 2. Apply Filters (Sender -> Search -> Type) to get "Processed" (Visible) Emails
  const processedEmails = useMemo(() => {
    let filtered = emails;

    // Filter by Sender
    if (senderFilter !== 'all') {
      filtered = filtered.filter(e => e.user === senderFilter);
    } else if (currentUser && !userProfile) {
      // Optional: If in Incognito (no userProfile), and currentUser is known,
      // should we default to currentUser?
      // User requested manual switching.
      // But maybe default to 'all' is better to show everything available?
      // Let's stick to manual filter via dropdown.
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        (e.recipient && e.recipient.toLowerCase().includes(q)) ||
        (e.body && e.body.toLowerCase().includes(q))
      );
    }

    // Status Filter
    if (filterType === 'opened') {
      filtered = filtered.filter(e => e.openCount > 0);
    } else if (filterType === 'sent') {
      filtered = filtered.filter(e => e.openCount === 0);
    }

    return filtered;
  }, [emails, senderFilter, searchQuery, filterType]);

  // Update Stats based on VISIBLE emails
  useEffect(() => {
    const tracked = processedEmails.length;
    const opened = processedEmails.filter(e => e.openCount > 0).length;
    setStats({
      tracked,
      opened,
      rate: tracked > 0 ? Math.round((opened / tracked) * 100) : 0
    });
  }, [processedEmails]);



  // -- MAIN RENDER --

  // If Detail View is active, overlay it
  if (selectedEmail) {
    return <DetailView email={selectedEmail} onBack={() => setSelectedEmail(null)} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        onRefresh={loadInitialData}
        loading={loading}
        userProfile={userProfile}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>
        {view === 'dashboard' && (
          <DashboardView
            stats={stats}
            error={error}
            uniqueSenders={uniqueSenders}
            senderFilter={senderFilter}
            setSenderFilter={setSenderFilter}
            processedEmails={processedEmails}
            onEmailClick={setSelectedEmail}
            onViewAllClick={() => setView('activity')}
          />
        )}
        {view === 'activity' && (
          <ActivityView
            uniqueSenders={uniqueSenders}
            senderFilter={senderFilter}
            setSenderFilter={setSenderFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterType={filterType}
            setFilterType={setFilterType}
            processedEmails={processedEmails}
            onEmailClick={setSelectedEmail}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            globalEnabled={globalEnabled}
            toggleGlobal={toggleGlobal}
            bodyPreviewLength={bodyPreviewLength}
            handleBodyPreviewChange={handleBodyPreviewChange}
            userProfile={userProfile}
            senderFilter={senderFilter}
            loading={loading}
            activeIdentity={activeIdentity}
            onDeleteHistory={confirmDeleteHistory}
          />
        )}
      </main>

      {/* Bottom Tabs */}
      <nav style={{
        height: '60px', background: 'var(--color-bg-card)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexShrink: 0
      }}>
        <TabButton label="Dashboard" icon="📊" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <TabButton label="Activity" icon="list" active={view === 'activity'} onClick={() => setView('activity')} />
        <TabButton label="Settings" icon="⚙️" active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>
      <Modal
        isOpen={statusModal.isOpen}
        title={statusModal.title}
        message={statusModal.message}
        type={statusModal.type}
        confirmLabel="Close"
        showCancel={false}
        onConfirm={() => setStatusModal({ ...statusModal, isOpen: false })}
        onCancel={() => setStatusModal({ ...statusModal, isOpen: false })}
      />
    </div>
  );
}

export default App;
