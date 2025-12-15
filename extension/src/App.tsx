
import { useEffect, useState, useMemo } from 'react';
import './index.css'; // Global Reset
import { Header } from './components/Layout/Header';
// formatRecipient removed
import { EmailItem } from './components/activity/EmailItem';
import { DetailView } from './components/activity/DetailView';
import { Card } from './components/common/Card';
import { API_CONFIG } from './config/api';
import { theme } from './config/theme';
import { Modal } from './components/common/Modal';
import { CONSTANTS } from './config/constants';

import { LocalStorageService } from './services/LocalStorageService';
import type { TrackedEmail } from './types';
import { AuthService, type UserProfile } from './services/AuthService';

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

  // Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'danger' | 'info' }>({
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

    // 0. Check Auth (Silent)
    let profile: UserProfile | null = null;
    try {
      const token = await AuthService.getAuthToken(false);
      if (token) {
        setAuthToken(token);
        try {
          profile = await AuthService.getUserProfile(token);
          setUserProfile(profile);
        } catch (ignored) { }
      }
    } catch (e) { }

    // 1. Load Local Storage (Current User only)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const local = await chrome.storage.local.get(['currentUser']);
      if (local.currentUser && typeof local.currentUser === 'string') {
        setCurrentUser(local.currentUser);
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['trackingEnabled', 'bodyPreviewLength'], (res) => {
        if (res.trackingEnabled !== undefined) {
          setGlobalEnabled(!!res.trackingEnabled);
        }
        // Default to 0 if not set (GDPR: privacy by default)
        const previewLength = typeof res.bodyPreviewLength === 'number' ? res.bodyPreviewLength : 0;
        setBodyPreviewLength(previewLength);
      });
    }

    // 2. Fetch Data
    await fetchEmails(profile);
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
      serverEmails.forEach(e => {
        emailMap.set(e.id, {
          ...e,
          openCount: (e as any)._count?.opens ?? e.openCount ?? 0,
          opens: e.opens || []
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

        if (senderFilter !== 'all') {
          // Case A: Deleting specific sender
          senderToDelete = senderFilter;
          // Find all local emails for this sender to identify server pixels
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

          // IMPORTANT: Also send 'user' for authorization
          // If these IDs were synced to cloud, backend needs to verify ownership
          if (senderToDelete) {
            params.append('user', senderToDelete);
          }

          const res = await fetch(`${urlBase}?${params.toString()}`, { method: 'DELETE' });
          if (!res.ok) console.warn('Server deletion partial failure', await res.text());
        }

        // 2. Delete Local Data
        if (senderToDelete) {
          await LocalStorageService.deleteBySender(senderToDelete);
          // If we deleted the history of the current "active" ghost user, we should reset that identity
          // so the UI doesn't claim we are still managing that user's data (which is now empty).
          if (currentUser === senderToDelete) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              await chrome.storage.local.remove(['currentUser']);
            }
            setCurrentUser(null);
          }
        } else {
          await LocalStorageService.deleteAll();
          // Delete All -> Definitely clear current user identity
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.remove(['currentUser']);
          }
          setCurrentUser(null);
        }
      }

      // Reset State
      setEmails([]);
      setStats({ tracked: 0, opened: 0, rate: 0 });
      setIsDeleteModalOpen(false); // Close confirmation modal

      // Refresh to show remaining state (e.g. if we only deleted one sender)
      loadInitialData();

      setStatusModal({
        isOpen: true,
        title: 'History Deleted',
        message: 'Tracking history has been cleared successfully.',
        type: 'success'
      });
    } catch (e) {
      setIsDeleteModalOpen(false);
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



  // -- RENDERERS --

  // 1. Dashboard View
  const renderDashboard = () => (
    <div style={{ padding: '12px' }}>
      {/* Sender Filter for Dashboard Scope - show only if multiple senders */}
      {uniqueSenders.length > 1 && (
        <div style={{ marginBottom: '12px' }}>
          <select
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-main)',
              fontSize: '13px'
            }}
          >
            <option value="all">All Senders</option>
            {uniqueSenders.map(sender => (
              <option key={sender} value={sender}>{sender}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <Card>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)' }}>{stats.tracked}</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Emails Tracked
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: '24px', fontWeight: 800, color: stats.rate > 50 ? theme.colors.successText : theme.colors.primary }}>
            {stats.rate}%
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Open Rate
          </div>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: theme.colors.dangerLight,
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: theme.colors.danger,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: `1px solid ${theme.colors.danger}`
        }}>
          <span>⚠️</span> {error}
        </div>
      )}



      {/* Recent Activity Preview */}
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Recent Activity</h3>
        <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {processedEmails.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: theme.colors.gray400 }}>No activity yet.</div>
          ) : (
            processedEmails.slice(0, CONSTANTS.DASHBOARD_RECENT_COUNT).map(email => (
              <EmailItem
                key={email.id}
                email={email}
                onClick={() => { setSelectedEmail(email); }}
              />
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => setView('activity')}
        style={{
          width: '100%', padding: '12px', background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          fontWeight: 500, cursor: 'pointer', color: 'var(--color-primary)'
        }}
      >
        View All Activity
      </button>
    </div>
  );

  // 2. Activity View
  const renderActivity = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search & Filter - Clean Container */}
      <div style={{
        padding: '12px',
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)' // Explicit separator below header ONLY
      }}>
        {/* Sender Filter - show only if multiple senders */}
        {uniqueSenders.length > 1 && (
          <select
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-main)',
              fontSize: '13px'
            }}
          >
            <option value="all">All Senders</option>
            {uniqueSenders.map(sender => (
              <option key={sender} value={sender}>{sender}</option>
            ))}
          </select>
        )}

        <input
          type="text"
          placeholder="Search subject, body, recipient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input" // Use CSS class for styling
          style={{ marginBottom: '10px' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <FilterChip label="All" active={filterType === 'all'} onClick={() => setFilterType('all')} />
          <FilterChip label="Opened" active={filterType === 'opened'} onClick={() => setFilterType('opened')} />
          <FilterChip label="Sent" active={filterType === 'sent'} onClick={() => setFilterType('sent')} />
        </div>
      </div>

      {/* List Container - No extra borders */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        {processedEmails.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: theme.colors.gray400 }}>
            {searchQuery || senderFilter !== 'all' ? 'No matches found.' : 'No emails found.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {processedEmails.map((email, index) => (
              <div key={email.id} style={{
                borderBottom: index === processedEmails.length - 1 ? 'none' : '1px solid var(--color-border)'
              }}>
                <EmailItem
                  email={email}
                  onClick={() => setSelectedEmail(email)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 3. Settings View
  const renderSettings = () => (
    <div style={{ padding: 'var(--spacing-md)' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 500 }}>Global Tracking</h4>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Auto-inject pixel into new emails
            </p>
          </div>
          <div
            onClick={toggleGlobal}
            style={{
              width: '44px', height: '24px', background: globalEnabled ? theme.colors.primary : theme.colors.gray200,
              borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
            }}
          >
            <div style={{
              width: '20px', height: '20px', background: 'white', borderRadius: '50%',
              position: 'absolute', top: '2px', left: globalEnabled ? '22px' : '2px',
              transition: 'left 0.3s', boxShadow: theme.shadows.toggle
            }} />
          </div>
        </div>
      </Card>

      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Email Body Preview</h4>
        <Card>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Save Content Preview</h4>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Store email content for easier identification in tracking history
                </p>
              </div>
            </div>

            <select
              value={bodyPreviewLength}
              onChange={(e) => handleBodyPreviewChange(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: '13px',
                background: 'var(--color-bg-card)',
                color: 'var(--color-text-main)',
                cursor: 'pointer'
              }}
            >
              <option value={0}>Disabled (Recommended for privacy)</option>
              <option value={50}>50 characters</option>
              <option value={100}>100 characters</option>
              <option value={150}>150 characters</option>
              <option value={200}>200 characters</option>
              <option value={-1}>Full email</option>
            </select>

            {bodyPreviewLength !== 0 && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: theme.colors.infoLight,
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: theme.colors.infoDark,
                display: 'flex',
                gap: '6px',
                alignItems: 'flex-start'
              }}>
                <span>ℹ️</span>
                <span>Email content will be stored on your tracking server. We recommend keeping this disabled for sensitive communications.</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px', textTransform: 'uppercase' }}>Danger Zone</h4>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#ef4444' }}>Delete History</span>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', margin: 0 }}>
                {userProfile
                  ? `Permanently delete all tracking data for account ${userProfile.email}`
                  : senderFilter !== 'all'
                    ? `Delete tracking data for sender: ${senderFilter}`
                    : 'Delete all local tracking history'
                }
              </p>
            </div>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={loading || (!userProfile && !activeIdentity && senderFilter === 'all')}
              style={{
                fontSize: '11px',
                color: theme.colors.danger,
                background: 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${theme.colors.danger}`,
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: (loading || (!userProfile && !activeIdentity && senderFilter === 'all')) ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              Delete {senderFilter !== 'all' && !userProfile ? 'Sender' : 'All'}
            </button>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        title="Delete Tracking History"
        message={
          <span>
            {userProfile ? (
              <>
                Are you sure you want to <b>DELETE ALL</b> tracking history for cloud account <b>{userProfile.email}</b>?
              </>
            ) : senderFilter !== 'all' ? (
              <>
                Are you sure you want to delete all tracking history for sender <b>{senderFilter}</b>?
                <br /><br />
                <i style={{ fontSize: '10px' }}>Other senders' history will remain intact.</i>
              </>
            ) : (
              <>
                Are you sure you want to <b>DELETE ALL</b> local tracking history?
              </>
            )}
            <br /><br />
            This action cannot be undone.
          </span>
        }
        type="danger"
        confirmLabel="Delete Forever"
        onConfirm={confirmDeleteHistory}
        onCancel={() => setIsDeleteModalOpen(false)}
        loading={loading}
      />

    </div>
  );

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
        {view === 'dashboard' && renderDashboard()}
        {view === 'activity' && renderActivity()}
        {view === 'settings' && renderSettings()}
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

const TabButton = ({ label, icon, active, onClick }: any) => (
  <button
    onClick={onClick}
    style={{
      background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '4px', cursor: 'pointer', color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
      flex: 1, padding: '8px'
    }}
  >
    <span style={{ fontSize: '18px' }}>{icon === 'list' ? '📋' : icon}</span>
    <span style={{ fontSize: '10px', fontWeight: 500 }}>{label}</span>
  </button>
);

const FilterChip = ({ label, active, onClick }: any) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 12px',
      borderRadius: '16px',
      border: 'none',
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
      background: active ? theme.colors.primary : theme.colors.gray200,
      color: active ? 'white' : theme.colors.gray500,
      transition: 'all 0.2s'
    }}
  >
    {label}
  </button>
);

export default App;
