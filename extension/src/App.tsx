
import './index.css';
import { MainLayout } from './components/Layout/MainLayout';
import { DetailView } from './components/activity/DetailView';
import { Modal } from './components/common/Modal';
import { DashboardView } from './views/DashboardView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';

import { useAppController } from './hooks/useAppController';

const App = () => {
  const { state, actions } = useAppController();
  const { view, selectedEmail, userProfile, loading, error, activeIdentity, stats, uniqueSenders, senderFilter, searchQuery, filterType, processedEmails, statusModal, globalEnabled, bodyPreviewLength } = state;

  // -- VIEW --

  if (selectedEmail) {
    return <DetailView email={selectedEmail} onBack={() => actions.setSelectedEmail(null)} />;
  }

  return (
    <>
      <MainLayout
        userProfile={userProfile}
        loading={loading}
        onLogin={actions.handleLogin}
        onLogout={actions.logout}
        onRefresh={() => actions.fetchEmails()}
        currentView={view}
        onViewChange={actions.setView}
      >
        {view === 'dashboard' && (
          <DashboardView
            stats={stats}
            error={error}
            uniqueSenders={uniqueSenders}
            senderFilter={senderFilter}
            setSenderFilter={actions.setSenderFilter}
            processedEmails={processedEmails}
            onEmailClick={actions.setSelectedEmail}
            onViewAllClick={() => actions.setView('activity')}
          />
        )}
        {view === 'activity' && (
          <ActivityView
            uniqueSenders={uniqueSenders}
            senderFilter={senderFilter}
            setSenderFilter={actions.setSenderFilter}
            searchQuery={searchQuery}
            setSearchQuery={actions.setSearchQuery}
            filterType={filterType}
            setFilterType={actions.setFilterType}
            processedEmails={processedEmails}
            onEmailClick={actions.setSelectedEmail}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            globalEnabled={globalEnabled}
            toggleGlobal={actions.toggleGlobal}
            bodyPreviewLength={bodyPreviewLength}
            handleBodyPreviewChange={actions.setBodyPreviewLength}
            userProfile={userProfile}
            senderFilter={senderFilter}
            loading={loading}
            activeIdentity={activeIdentity}
            onDeleteHistory={actions.handleDeleteHistory}
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
        onConfirm={actions.closeStatus}
        onCancel={actions.closeStatus}
      />
    </>
  );
}

export default App;
