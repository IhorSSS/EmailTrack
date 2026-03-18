import './index.css';
import { MainLayout } from './components/Layout/MainLayout';
import { DetailView } from './components/activity/DetailView';
import { DashboardView } from './views/DashboardView';
import { ActivityView } from './views/ActivityView';
import { SettingsView } from './views/SettingsView';

import { useAppController } from './hooks/useAppController';
import { useThemeApplier } from './hooks/useThemeApplier';
import { useTranslation } from './hooks/useTranslation';

import { LogoutModal } from './components/modals/LogoutModal';
import { DeleteHistoryModal } from './components/modals/DeleteHistoryModal';
import { DeleteSingleEmailModal } from './components/modals/DeleteSingleEmailModal';
import { ConflictModal } from './components/modals/ConflictModal';
import { ErrorModal } from './components/modals/ErrorModal';

const App = () => {
  const { t } = useTranslation();
  const { state, actions } = useAppController();
  const {
    view, selectedEmail, userProfile, loading, error,
    stats, uniqueSenders, senderFilter, searchQuery, filterType,
    processedEmails, senderFilteredEmails, statusModal, globalEnabled, bodyPreviewLength,
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
        currentView={view as 'dashboard' | 'activity' | 'settings'}
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
            processedEmails={senderFilteredEmails}
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
      <ErrorModal
        isOpen={statusModal.isOpen}
        title={statusModal.title}
        message={statusModal.message}
        onConfirm={actions.closeStatus}
      />

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={logoutModalOpen}
        userEmail={userProfile?.email}
        onConfirm={() => actions.confirmLogout(true)}
        onCancel={() => actions.confirmLogout(false)}
        onClose={actions.closeLogoutModal}
      />

      {/* Delete Confirmation Modal (Bulk) */}
      <DeleteHistoryModal
        isOpen={deleteConfirmModalOpen}
        senderFilter={senderFilter}
        uniqueSenders={uniqueSenders}
        onConfirm={() => {
          actions.handleDeleteHistory();
          actions.closeDeleteConfirm();
        }}
        onCancel={actions.closeDeleteConfirm}
        onSenderChange={actions.setSenderFilter}
      />

      {/* Delete Confirmation Modal (Single) */}
      <DeleteSingleEmailModal
        isOpen={!!emailToDelete}
        emailSubject={emailToDelete?.subject}
        onConfirm={actions.handleDeleteSingleEmail}
        onCancel={actions.closeDeleteSingleConfirm}
      />

      {/* Account Mismatch / Conflict Modal */}
      <ConflictModal
        isOpen={!!conflictEmail}
        onConfirm={() => actions.resolveConflict(true)}
        onCancel={() => actions.resolveConflict(false)}
      />

      {/* Auth Error Modal */}
      <ErrorModal
        isOpen={!!authError && !authError.includes('Account Conflict')}
        title={t('modal_auth_error_title')}
        message={authError || ''}
        onConfirm={actions.clearAuthError}
      />
    </>
  );
}

export default App;

