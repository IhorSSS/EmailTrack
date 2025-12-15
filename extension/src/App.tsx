
import { useEffect, useState, useMemo } from 'react';
import './index.css'; // Global Reset
import { Header } from './components/Layout/Header';
// formatRecipient removed
import { EmailItem } from './components/activity/EmailItem';
import { DetailView } from './components/activity/DetailView';
import { Card } from './components/common/Card';
import { API_CONFIG } from './config/api';
import { theme } from './config/theme';
import { CONSTANTS } from './config/constants';

interface TrackedEmail {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  user?: string;
  createdAt: string;
  opens: any[];
  openCount: number;
  _count?: { opens: number }; // Backend format
}

function App() {
  const [view, setView] = useState<'dashboard' | 'activity' | 'settings'>('dashboard');
  const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);

  // Data
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [globalEnabled, setGlobalEnabled] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'opened' | 'sent'>('all');

  // Stats
  const [stats, setStats] = useState({ tracked: 0, opened: 0, rate: 0 });

  // -- EFFECTS --

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);

    // 1. Load Local Storage (Deleted IDs & Current User)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const local = await chrome.storage.local.get(['deletedIds', 'currentUser']);
      if (local.deletedIds && Array.isArray(local.deletedIds)) {
        setDeletedIds(new Set(local.deletedIds as string[]));
      }
      if (local.currentUser && typeof local.currentUser === 'string') {
        setCurrentUser(local.currentUser);
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['trackingEnabled'], (res) => {
        if (res.trackingEnabled !== undefined) {
          setGlobalEnabled(!!res.trackingEnabled);
        }
      });
    }

    // 2. Fetch Data
    await fetchEmails();
  };

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Increased limit to 1000 to get a good history window
      let url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}?limit=${API_CONFIG.PARAMS.DASHBOARD_LIMIT}`;
      if (currentUser) {
        url += `&user=${encodeURIComponent(currentUser)}`;
      }
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const list: TrackedEmail[] = data.data || [];

      // Transform backend response: _count.opens -> openCount
      const transformedList = list.map(email => ({
        ...email,
        openCount: email._count?.opens ?? email.openCount ?? 0,
        opens: email.opens || []
      }));

      setEmails(transformedList);
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

  const handleDelete = (id: string) => {
    // Confirm? Maybe not needed for just a history cleanup
    const newSet = new Set(deletedIds);
    newSet.add(id);
    setDeletedIds(newSet);

    // Persist
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ deletedIds: Array.from(newSet) });
    }
  };

  // -- COMPUTED DATA --

  const processedEmails = useMemo(() => {
    let filtered = emails;

    // 1. Exclude Deleted
    filtered = filtered.filter(e => !deletedIds.has(e.id));

    // 2. Filter by Current User (if known) -> "Dynamic pulling... for specific user"
    // Only apply if we actually have a user to filter by.
    if (currentUser) {
      // Check if the email object has a 'user' field. If backend doesn't send it yet, we might skip this.
      // But assuming we updated backend or will update it.
      // SAFEGUARD: If 'user' field is missing in data, show all (fallback).
      filtered = filtered.filter(e => !e.user || e.user === currentUser);
    }

    return filtered;
  }, [emails, deletedIds, currentUser]);

  const displayEmails = useMemo(() => {
    let filtered = processedEmails;

    // 3. Search (Body, Subject, Recipient)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        (e.recipient && e.recipient.toLowerCase().includes(q)) ||
        (e.body && e.body.toLowerCase().includes(q))
      );
    }

    // 4. Status Filter
    if (filterType === 'opened') {
      filtered = filtered.filter(e => e.openCount > 0);
    } else if (filterType === 'sent') {
      filtered = filtered.filter(e => e.openCount === 0);
    }

    return filtered;
  }, [processedEmails, searchQuery, filterType]);

  // Update Stats based on PROCESSED (User's) emails, not global
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
    <div style={{ padding: 'var(--spacing-md)' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <Card>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)' }}>{stats.tracked}</div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
            Emails Tracked
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: '28px', fontWeight: 800, color: stats.rate > 50 ? theme.colors.successText : theme.colors.primary }}>
            {stats.rate}%
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
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

      {/* Current User Badge */}
      {currentUser && (
        <div style={{ marginBottom: '16px', padding: '8px 12px', background: theme.colors.infoLight, borderRadius: '6px', fontSize: '13px', color: theme.colors.infoDark, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>👤</span> Logged in as: <strong>{currentUser}</strong>
        </div>
      )}

      {/* Recent Activity Preview */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Recent Activity</h3>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {processedEmails.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: theme.colors.gray400 }}>No activity yet.</div>
          ) : (
            processedEmails.slice(0, CONSTANTS.DASHBOARD_RECENT_COUNT).map(email => (
              <EmailItem
                key={email.id}
                email={email}
                onClick={() => { setSelectedEmail(email); }}
                onDelete={() => handleDelete(email.id)}
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search & Filter Bar */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
        <input
          type="text"
          placeholder="Search subject, body, recipient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)',
            marginBottom: '10px', fontSize: '13px'
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <FilterChip label="All" active={filterType === 'all'} onClick={() => setFilterType('all')} />
          <FilterChip label="Opened" active={filterType === 'opened'} onClick={() => setFilterType('opened')} />
          <FilterChip label="Sent" active={filterType === 'sent'} onClick={() => setFilterType('sent')} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayEmails.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: theme.colors.gray400 }}>
            {searchQuery ? 'No matches found.' : 'No emails found.'}
          </div>
        ) : (
          displayEmails.map(email => (
            <EmailItem
              key={email.id}
              email={email}
              onClick={() => setSelectedEmail(email)}
              onDelete={() => handleDelete(email.id)}
            />
          ))
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
        <h4 style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Data & Storage</h4>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px' }}>Clear Hidden History</span>
            <button
              onClick={() => {
                setDeletedIds(new Set());
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                  chrome.storage.local.remove('deletedIds');
                }
              }}
              style={{ fontSize: '11px', color: theme.colors.danger, background: 'none', border: `1px solid ${theme.colors.dangerLight}`, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Reset
            </button>
          </div>
        </Card>
      </div>
    </div>
  );

  // -- MAIN RENDER --

  // If Detail View is active, overlay it
  if (selectedEmail) {
    return <DetailView email={selectedEmail} onBack={() => setSelectedEmail(null)} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header onRefresh={loadInitialData} loading={loading} />

      {/* Content Area */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>
        {view === 'dashboard' && renderDashboard()}
        {view === 'activity' && renderActivity()}
        {view === 'settings' && renderSettings()}
      </main>

      {/* Bottom Tabs */}
      <nav style={{
        height: '60px', background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexShrink: 0
      }}>
        <TabButton label="Dashboard" icon="📊" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <TabButton label="Activity" icon="list" active={view === 'activity'} onClick={() => setView('activity')} />
        <TabButton label="Settings" icon="⚙️" active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>
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
