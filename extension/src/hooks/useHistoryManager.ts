

/**
 * Hook to manage history deletion logic
 * Decouples this logic from the main App component
 */
export const useHistoryManager = (
    deleteEmails: (filter: string, ids: string[]) => Promise<{ success: boolean; message: string }>,
    senderFilter: string,
    userProfile: any,
    showStatus: (title: string, message: string, type: any) => void,
    setCurrentUser: (user: string | null) => void
) => {

    const handleDeleteHistory = async () => {
        // Check context validity
        if (typeof chrome !== 'undefined' && chrome.runtime && !chrome.runtime.id) {
            showStatus('Context Invalidated', 'Extension context invalidated. Reload page.', 'danger');
            return;
        }

        try {
            const result = await deleteEmails(senderFilter, []);

            showStatus(
                result.success ? 'History Deleted' : 'Data Queued',
                result.message,
                result.success ? 'success' : 'warning'
            );

            // Logic to clear current user if we just deleted the active local history
            const currentUser = localStorage.getItem('currentUser'); // Or passed from props if needed, but managing local state here

            // If local delete happened and it matched currentUser, clear it
            if (!userProfile && senderFilter !== 'all' && currentUser === senderFilter) {
                setCurrentUser(null);
            } else if (!userProfile && senderFilter === 'all') {
                setCurrentUser(null);
            }

        } catch (e: any) {
            showStatus('Error', 'Error clearing history: ' + e.message, 'danger');
        }
    };

    return {
        handleDeleteHistory
    };
};
