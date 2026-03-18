import { useTranslation } from './useTranslation';
import { CONSTANTS } from '../config/constants';

/**
 * Hook to manage history deletion logic
 * Decouples this logic from the main App component
 */
export const useHistoryManager = (
    deleteEmails: (filter: string) => Promise<{ success: boolean; message: string; type?: 'success' | 'warning' }>,
    senderFilter: string,
    setSenderFilter: (filter: string) => void,
    userProfile: { email: string } | null,
    showStatus: (title: string, message: string, type: 'success' | 'danger' | 'warning' | 'info') => void,
    setCurrentUser: (user: string | null) => void,
    currentUser: string | null
) => {
    const { t } = useTranslation();

    const handleDeleteHistory = async () => {
        // Check context validity
        if (typeof chrome !== 'undefined' && chrome.runtime && !chrome.runtime.id) {
            showStatus(t('modal_status_context_invalid'), t('error_context_invalidated'), 'danger');
            return;
        }

        try {
            const result = await deleteEmails(senderFilter);

            showStatus(
                result.type === 'warning' ? t('modal_status_note') : (result.success ? t('modal_status_history_deleted') : t('modal_status_data_queued')),
                result.message,
                result.type || (result.success ? 'success' : 'warning')
            );

            // If local delete happened and it matched currentUser, clear it
            if (!userProfile && senderFilter !== 'all' && currentUser === senderFilter) {
                setCurrentUser(null);
            } else if (!userProfile && senderFilter === 'all') {
                setCurrentUser(null);
            }

            // If full wipe, clear who we thought was logged in
            if (senderFilter === 'all') {
                chrome.storage.local.remove([CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL]);
            }

            // RESET FILTER so UI doesn't show an empty list
            if (result.success && senderFilter !== 'all') {
                setSenderFilter('all');
            }

        } catch (e: unknown) {
            const errBase = e as Error;
            showStatus(t('modal_status_error'), t('error_history_clear_failed') + ': ' + (errBase.message || String(e)), 'danger');
        }
    };

    return {
        handleDeleteHistory
    };
};
