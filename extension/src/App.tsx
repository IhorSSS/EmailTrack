
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
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [bodyPreviewLength, setBodyPreviewLength] = useState(0); // 0 = disabled

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
    await fetchEmails();
  };

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Increased limit to 1000 to get a good history window
      // Force no-cache to get fresh list
      let url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}?limit=${API_CONFIG.PARAMS.DASHBOARD_LIMIT}&t=${Date.now()}`;
      if (currentUser) {
        url += `&user=${encodeURIComponent(currentUser)}`;
      }
      const res = await fetch(url, {
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const { data, total } = await res.json();
      const list: TrackedEmail[] = data || [];

      // Transform backend response
      const transformedList = list.map((email: any) => ({
        ...email,
        openCount: email._count?.opens ?? email.openCount ?? 0,
        opens: email.opens || []
      }));

      // No more hidden emails filter
      setEmails(transformedList);

      // Recalculate stats using TOTAL from backend for accuracy
      const tracked = total || transformedList.length;
      const opened = transformedList.filter((e: TrackedEmail) => e.openCount > 0).length;
      const rate = transformedList.length > 0 ? Math.round((opened / transformedList.length) * 100) : 0;

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

  const handleDeleteAllHistory = async () => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to DELETE ALL tracking history? This cannot be undone.')) return;

    setLoading(true);
    try {
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}?user=${encodeURIComponent(currentUser)}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete history');

      // Clear local state
      setEmails([]);
      setStats({ tracked: 0, opened: 0, rate: 0 });
      alert('History cleared successfully.');
    } catch (e) {
      alert('Error clearing history: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  // -- COMPUTED DATA --

  const processedEmails = useMemo(() => {
    let filtered = emails;

    // Filter by Current User (if known)
    if (currentUser) {
      filtered = filtered.filter(e => !e.user || e.user === currentUser);
    }

    return filtered;
  }, [emails, currentUser]); // Removed deletedIds dependency

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
    <div style={{ padding: '12px' }}>
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

      {/* Current User Badge */}
      {currentUser && (
        <div style={{ marginBottom: '16px', padding: '8px 12px', background: theme.colors.infoLight, borderRadius: '6px', fontSize: '13px', color: theme.colors.infoDark, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>👤</span> Logged in as: <strong>{currentUser}</strong>
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
        {displayEmails.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: theme.colors.gray400 }}>
            {searchQuery ? 'No matches found.' : 'No emails found.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayEmails.map((email, index) => (
              <div key={email.id} style={{
                borderBottom: index === displayEmails.length - 1 ? 'none' : '1px solid var(--color-border)'
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
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#ef4444' }}>Delete All History</span>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', margin: 0 }}>
                Permanently delete all tracking data for {currentUser}
              </p>
            </div>
            <button
              onClick={handleDeleteAllHistory}
              disabled={loading || !currentUser}
              style={{
                fontSize: '11px',
                color: theme.colors.danger,
                background: 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${theme.colors.danger}`,
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: (loading || !currentUser) ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              Delete All
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
        height: '60px', background: 'var(--color-bg-card)',
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
