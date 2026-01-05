import './index.css';
import { MainLayout } from './components/Layout/MainLayout';
import { DetailView } from './components/activity/DetailView';
import { Modal } from './components/common/Modal';
import { DashboardView } from './views/DashboardView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';

import { useAppController } from './hooks/useAppController';
import { useThemeApplier } from './hooks/useThemeApplier';
import { Select } from './components/common/Select';

const App = () => {
  const { state, actions } = useAppController();
  const {
    view, selectedEmail, userProfile, loading, error,
    stats, uniqueSenders, senderFilter, searchQuery, filterType,
    processedEmails, statusModal, globalEnabled, bodyPreviewLength,
    logoutModalOpen, deleteConfirmModalOpen, conflictEmail, theme, authError,
    emailToDelete
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
            onDeleteClick={actions.openDeleteSingleConfirm}
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
            onDeleteClick={actions.openDeleteSingleConfirm}
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
            loading={loading}
            openDeleteConfirm={actions.openDeleteConfirm}
            theme={theme}
            setTheme={actions.setTheme}
            showTrackingIndicator={state.showTrackingIndicator}
            setShowTrackingIndicator={actions.setShowTrackingIndicator}
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

      {/* Delete Confirmation Modal (Bulk) */}
      <Modal
        isOpen={deleteConfirmModalOpen}
        title="Clear Tracking Data"
        message={
          <span>
            Are you sure you want to permanently delete the tracking history?
            This action cannot be undone.
          </span>
        }
        type="danger"
        confirmLabel="Yes, Delete Data"
        cancelLabel="Cancel"
        showCancel={true}
        onConfirm={() => {
          actions.handleDeleteHistory(); // This will use the CURRENT senderFilter from state
          actions.closeDeleteConfirm();
        }}
        onCancel={actions.closeDeleteConfirm}
      >
        <div style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Choose which sender's history to clear:
          </p>
          <Select
            value={senderFilter}
            onChange={(e) => actions.setSenderFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Senders' },
              ...uniqueSenders.map(s => ({ value: s, label: s }))
            ]}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal (Single) */}
      <Modal
        isOpen={!!emailToDelete}
        title="Remove from History"
        message={
          <span>
            Are you sure you want to remove tracking data for:
            <br /><br />
            <b>{emailToDelete?.subject || '(No Subject)'}</b>
            <br /><br />
            This will permanently delete this record from your history and stop tracking its opens.
          </span>
        }
        type="danger"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        showCancel={true}
        onConfirm={actions.handleDeleteSingleEmail}
        onCancel={actions.closeDeleteSingleConfirm}
        onClose={actions.closeDeleteSingleConfirm}
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

