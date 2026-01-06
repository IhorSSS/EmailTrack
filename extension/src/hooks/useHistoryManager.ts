
import { useTranslation } from './useTranslation';

/**
 * Hook to manage history deletion logic
 * Decouples this logic from the main App component
 */
export const useHistoryManager = (
    deleteEmails: (filter: string) => Promise<{ success: boolean; message: string; type?: 'success' | 'warning' }>,
    senderFilter: string,
    setSenderFilter: (filter: string) => void,
    userProfile: any,
    showStatus: (title: string, message: string, type: any) => void,
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
                chrome.storage.local.remove(['lastLoggedInEmail']);
            }

            // RESET FILTER so UI doesn't show an empty list
            if (result.success && senderFilter !== 'all') {
                setSenderFilter('all');
            }

        } catch (e: any) {
            showStatus(t('modal_status_error'), t('error_history_clear_failed') + ': ' + e.message, 'danger');
        }
    };

    return {
        handleDeleteHistory
    };
};
