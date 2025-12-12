
import { useEffect, useState } from 'react';
import './App.css';

interface TrackedEmail {
  id: string;
  recipient: string;
  subject: string;
  createdAt: string;
  opens: any[];
  openCount: number;
}

interface DashboardData {
  data: TrackedEmail[];
  total: number;
  limit: number;
}

const API_BASE = 'http://localhost:3000';

function App() {
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalEnabled, setGlobalEnabled] = useState(true);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard?limit=50`);
      const data: DashboardData = await res.json();
      setEmails(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleGlobal = () => {
    const newState = !globalEnabled;
    setGlobalEnabled(newState);
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ trackingEnabled: newState });
    }
  };

  const handleTestConnection = () => {
    const testId = crypto.randomUUID();
    const HOST = 'https://salty-times-fold.loca.lt';
    window.open(`${HOST}/track/${testId}`, '_blank');
  };

  useEffect(() => {
    fetchEmails();
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['trackingEnabled'], (res) => {
        if (res.trackingEnabled !== undefined) {
          setGlobalEnabled(!!res.trackingEnabled);
        }
      });
    }
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h2>EmailTrack</h2>
        <button onClick={fetchEmails} className="refresh-btn">Refresh</button>
      </header>

      <div className="settings-panel" style={{ padding: '0 12px 12px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span style={{ fontWeight: 500, color: '#374151', fontSize: '14px' }}>Tracking</span>
          <div className="global-toggle">
            <label className="switch">
              <input
                type="checkbox"
                checked={globalEnabled}
                onChange={toggleGlobal}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </label>
      </div>

      <div className="stats-summary">
        <div className="stat-box">
          <span className="stat-val">{emails.length}</span>
          <span className="stat-label">Tracked</span>
        </div>
        <div className="stat-box">
          <span className="stat-val">{emails.filter(e => e.openCount > 0).length}</span>
          <span className="stat-label">Opened</span>
        </div>
        <button className="test-btn" onClick={handleTestConnection} style={{ padding: '4px 8px', fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Test Connection 📡
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="email-list">
          {emails.length === 0 ? (
            <p className="empty">No tracked emails.</p>
          ) : (
            emails.map((email) => (
              <div key={email.id} className="email-card">
                <div className="email-header">
                  <span className="recipient">{email.recipient || 'Unknown'}</span>
                  <span className={`status ${email.openCount > 0 ? 'opened' : 'sent'}`}>
                    {email.openCount > 0 ? 'OPENED' : 'SENT'}
                  </span>
                </div>
                <div className="subject">{email.subject || 'No Subject'}</div>
                <div className="details">
                  <span>Opens: {email.openCount}</span>
                  <span>{new Date(email.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App;
