import './index.css';
import { MainLayout } from './components/Layout/MainLayout';
import { DetailView } from './components/activity/DetailView';
import { Modal } from './components/common/Modal';
import { DashboardView } from './views/DashboardView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';

import { useAppController } from './hooks/useAppController';
import { useThemeApplier } from './hooks/useThemeApplier';

const App = () => {
  const { state, actions } = useAppController();
  const {
    view, selectedEmail, userProfile, loading, error,
    stats, uniqueSenders, senderFilter, searchQuery, filterType,
    processedEmails, statusModal, globalEnabled, bodyPreviewLength,
    logoutModalOpen, deleteConfirmModalOpen, conflictEmail, theme, authError
  } = state;

  useThemeApplier(theme);

  // -- VIEW --

  if (selectedEmail) {
    return (
      <DetailView
        email={selectedEmail}
        onBack={() => actions.setSelectedEmail(null)}
        onRefresh={actions.refreshSelectedEmail}
        loading={loading}
      />
    );
  }

  return (
    <>
      <MainLayout
        userProfile={userProfile}
        loading={loading}
        onLogin={actions.handleLogin}
        onLogout={actions.logout}
        onRefresh={() => actions.fetchEmails()}
        currentView={view as any}
        onViewChange={actions.setView}
      >
        {view === 'dashboard' && (
          <DashboardView
            stats={stats}
            loading={loading}
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
            loading={loading}
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
            openDeleteConfirm={actions.openDeleteConfirm}
            theme={theme}
            setTheme={actions.setTheme}
          />
        )}
      </MainLayout>

      {/* Status Modal */}
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

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={logoutModalOpen}
        title="Sign Out"
        message={
          <span>
            You are about to sign out of <b>{userProfile?.email}</b>.
            <br /><br />
            Would you like to clear the tracking history from this device, or keep it for offline viewing?
          </span>
        }
        type="info"
        confirmLabel="Clear Data & Sign Out"
        cancelLabel="Keep Data & Sign Out"
        showCancel={true}
        onConfirm={() => actions.confirmLogout(true)}
        onCancel={() => actions.confirmLogout(false)}
        onClose={actions.closeLogoutModal}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmModalOpen}
        title="Clear Tracking Data"
        message={
          <span>
            Are you sure you want to delete the tracking history?
            <br /><br />
            {userProfile
              ? `This will permanently clear history for ${userProfile.email} from this device.`
              : (senderFilter !== 'all' ? `This will permanently clear history for ${senderFilter} from this device.` : 'This will permanently clear all tracking data from this device.')
            }
          </span>
        }
        type="danger"
        confirmLabel="Yes, Delete Data"
        cancelLabel="Cancel"
        showCancel={true}
        onConfirm={() => {
          actions.handleDeleteHistory();
          actions.closeDeleteConfirm();
        }}
        onCancel={actions.closeDeleteConfirm}
      />

      {/* Account Mismatch / Conflict Modal */}
      <Modal
        isOpen={!!conflictEmail}
        title="Account Mismatch"
        message={
          <span>
            Local history belongs to <b>another account</b>.
            <br /><br />
            You are signing in with a different account. To protect privacy, you must decide how to handle the existing data.
          </span>
        }
        type="warning"
        confirmLabel="Clear All & Sign In"
        cancelLabel="Keep New Only & Sign In"
        showCancel={true}
        onConfirm={() => actions.resolveConflict(true)}
        onCancel={() => actions.resolveConflict(false)}
      />

      {/* Account Conflict / Auth Error Modal */}
      <Modal
        isOpen={!!authError && !authError.includes('Account Conflict')}
        title="Authentication Error"
        message={authError}
        type="danger"
        confirmLabel="Close"
        showCancel={false}
        onConfirm={actions.clearAuthError}
        onCancel={actions.clearAuthError}
      />
    </>
  );
}

export default App;

