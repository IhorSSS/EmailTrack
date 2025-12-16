import { useState, useEffect } from 'react';
import './index.css';
import { MainLayout } from './components/Layout/MainLayout';
import { DetailView } from './components/activity/DetailView';
import { Modal } from './components/common/Modal';
import { DashboardView } from './views/DashboardView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';

import type { TrackedEmail } from './types';
import { useAuth } from './hooks/useAuth';
import { useEmails } from './hooks/useEmails';
import { useFilteredEmails } from './hooks/useFilteredEmails';

const App = () => {
  const [view, setView] = useState<'dashboard' | 'activity' | 'settings'>('dashboard');
  const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);

  // -- APP UI STATE --
  const [currentUser, setCurrentUser] = useState<string | null>(null); // For Incognito logic inheritance
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'danger' | 'info' | 'warning' }>({
    isOpen: false, title: '', message: '', type: 'success'
  });

  // -- HOOKS --
  const { userProfile, authLoading, login, logout, authError } = useAuth();
  const { emails, stats, loading: dataLoading, error: dataError, fetchEmails, deleteEmails } = useEmails(userProfile, currentUser);

  // -- FILTER LOGIC (Extracted) --
  const {
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    senderFilter, setSenderFilter,
    uniqueSenders, processedEmails
  } = useFilteredEmails(emails);

  const loading = authLoading || dataLoading;
  const error = authError || dataError;

  // -- LOCAL SETTINGS STATE --
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [bodyPreviewLength, setBodyPreviewLength] = useState(0);

  // -- EFFECTS --

  // 1. Load Incognito "currentUser" from Local Storage on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['currentUser'], (result: { currentUser?: string }) => {
        if (result.currentUser) {
          setCurrentUser(result.currentUser);
        }
      });
    }
  }, []);

  // -- HANDLERS --

  const handleLogin = async () => {
    try {
      await login();
    } catch (e: any) {
      setStatusModal({
        isOpen: true,
        title: 'Login Failed',
        message: e.message || 'Could not sign in.',
        type: 'danger'
      });
    }
  };

  const handleDeleteHistory = async () => {
    // Check context
    if (typeof chrome !== 'undefined' && chrome.runtime && !chrome.runtime.id) {
      setStatusModal({ isOpen: true, title: 'Context Invalidated', message: 'Extension context invalidated. Reload page.', type: 'danger' });
      return;
    }

    try {
      const result = await deleteEmails(senderFilter, []);

      setStatusModal({
        isOpen: true,
        title: result.success ? 'History Deleted' : 'Data Queued',
        message: result.message,
        type: result.success ? 'success' : 'warning'
      });

      // If local delete happened and it matched currentUser, clear it
      if (!userProfile && senderFilter !== 'all' && currentUser === senderFilter) {
        setCurrentUser(null);
      } else if (!userProfile && senderFilter === 'all') {
        setCurrentUser(null);
      }

    } catch (e: any) {
      setStatusModal({
        isOpen: true,
        title: 'Error',
        message: 'Error clearing history: ' + e.message,
        type: 'danger'
      });
    }
  };

  const toggleGlobal = () => {
    setGlobalEnabled(!globalEnabled);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ trackingEnabled: !globalEnabled });
    }
  };

  const handleBodyPreviewChange = (value: number) => {
    setBodyPreviewLength(value);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ bodyPreviewLength: value });
    }
  };

  // -- VIEW --

  if (selectedEmail) {
    return <DetailView email={selectedEmail} onBack={() => setSelectedEmail(null)} />;
  }

  const activeIdentity = userProfile ? userProfile.email : currentUser;

  return (
    <>
      <MainLayout
        userProfile={userProfile}
        loading={loading}
        onLogin={handleLogin}
        onLogout={logout}
        onRefresh={() => fetchEmails()}
        currentView={view}
        onViewChange={setView}
      >
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
            onDeleteHistory={handleDeleteHistory}
          />
        )}
      </MainLayout>

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
    </>
  );
}

export default App;
