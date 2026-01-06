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
import { useTranslation } from './hooks/useTranslation';

const App = () => {
  const { t } = useTranslation();
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
        confirmLabel={t('common_close')}
        showCancel={false}
        onConfirm={actions.closeStatus}
        onCancel={actions.closeStatus}
      />

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={logoutModalOpen}
        title={t('modal_logout_title')}
        message={
          <span dangerouslySetInnerHTML={{ __html: t('modal_logout_message', { email: userProfile?.email || '' }) }} />
        }
        type="info"
        confirmLabel={t('modal_logout_action_clear')}
        cancelLabel={t('modal_logout_action_keep')}
        showCancel={true}
        onConfirm={() => actions.confirmLogout(true)}
        onCancel={() => actions.confirmLogout(false)}
        onClose={actions.closeLogoutModal}
      />

      {/* Delete Confirmation Modal (Bulk) */}
      <Modal
        isOpen={deleteConfirmModalOpen}
        title={t('modal_delete_title')}
        message={t('modal_delete_message')}
        type="danger"
        confirmLabel={t('modal_delete_action')}
        cancelLabel={t('common_cancel')}
        showCancel={true}
        onConfirm={() => {
          actions.handleDeleteHistory(); // This will use the CURRENT senderFilter from state
          actions.closeDeleteConfirm();
        }}
        onCancel={actions.closeDeleteConfirm}
      >
        <div style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {t('modal_delete_sender_select_label')}
          </p>
          <Select
            value={senderFilter}
            onChange={(e) => actions.setSenderFilter(e.target.value)}
            options={[
              { value: 'all', label: t('dashboard_filter_all_senders') },
              ...uniqueSenders.map(s => ({ value: s, label: s }))
            ]}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal (Single) */}
      <Modal
        isOpen={!!emailToDelete}
        title={t('modal_delete_single_title')}
        message={
          <span dangerouslySetInnerHTML={{ __html: t('modal_delete_single_message', { subject: emailToDelete?.subject || t('detail_no_subject') }) }} />
        }
        type="danger"
        confirmLabel={t('common_remove')}
        cancelLabel={t('common_cancel')}
        showCancel={true}
        onConfirm={actions.handleDeleteSingleEmail}
        onCancel={actions.closeDeleteSingleConfirm}
        onClose={actions.closeDeleteSingleConfirm}
      />

      {/* Account Mismatch / Conflict Modal */}
      <Modal
        isOpen={!!conflictEmail}
        title={t('modal_conflict_title')}
        message={
          <span dangerouslySetInnerHTML={{ __html: t('modal_conflict_message') }} />
        }
        type="warning"
        confirmLabel={t('modal_conflict_action_clear')}
        cancelLabel={t('modal_conflict_action_keep')}
        showCancel={true}
        onConfirm={() => actions.resolveConflict(true)}
        onCancel={() => actions.resolveConflict(false)}
      />

      {/* Account Conflict / Auth Error Modal */}
      <Modal
        isOpen={!!authError && !authError.includes('Account Conflict')}
        title={t('modal_auth_error_title')}
        message={authError}
        type="danger"
        confirmLabel={t('common_close')}
        showCancel={false}
        onConfirm={actions.clearAuthError}
        onCancel={actions.clearAuthError}
      />
    </>
  );
}

export default App;

