import { useState } from 'react';
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
import { useExtensionSettings } from './hooks/useExtensionSettings';
import { useStatusModal } from './hooks/useStatusModal';
import { useHistoryManager } from './hooks/useHistoryManager';

const App = () => {
  const [view, setView] = useState<'dashboard' | 'activity' | 'settings'>('dashboard');
  const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);

  // -- HOOKS --
  const { userProfile, authLoading, login, logout, authError } = useAuth();

  // -- SETTINGS HOOK --
  const {
    currentUser, setCurrentUser,
    globalEnabled, toggleGlobal,
    bodyPreviewLength, setBodyPreviewLength
  } = useExtensionSettings();

  // -- UI STATE --
  const { statusModal, showStatus, closeStatus } = useStatusModal();

  const { emails, stats, loading: dataLoading, error: dataError, fetchEmails, deleteEmails } = useEmails(userProfile, currentUser);

  // -- FILTER LOGIC --
  const {
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    senderFilter, setSenderFilter,
    uniqueSenders, processedEmails
  } = useFilteredEmails(emails);

  // -- HISTORY MANAGER --
  const { handleDeleteHistory } = useHistoryManager(
    deleteEmails,
    senderFilter,
    userProfile,
    showStatus,
    setCurrentUser
  );

  const loading = authLoading || dataLoading;
  const error = authError || dataError;

  // -- HANDLERS --

  const handleLogin = async () => {
    try {
      await login();
    } catch (e: any) {
      showStatus('Login Failed', e.message || 'Could not sign in.', 'danger');
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
            handleBodyPreviewChange={setBodyPreviewLength}
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
        onConfirm={closeStatus}
        onCancel={closeStatus}
      />
    </>
  );
}

export default App;
