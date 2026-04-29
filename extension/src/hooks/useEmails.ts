import { useEmailFetch } from './emails/useEmailFetch';
import { useEmailDelete } from './emails/useEmailDelete';
import { useEmailSync } from './emails/useEmailSync';
import type { UserProfile } from '../services/AuthService';

/**
 * useEmails Hook - Orchestrator
 * Decomposed into specialized sub-hooks for Fetch, Delete, and Sync.
 */
export const useEmails = (
    userProfile: UserProfile | null,
    currentUser: string | null,
    authToken: string | null,
    settingsLoaded: boolean = true
) => {
    const fetchProps = useEmailFetch(userProfile, currentUser, authToken, settingsLoaded);
    
    const { 
        emails, 
        stats, 
        loading, 
        isRefetching,
        error, 
        fetchEmails, 
        setEmails 
    } = fetchProps;

    const { 
        deleteEmails, 
        deleteSingleEmail 
    } = useEmailDelete(
        emails, 
        setEmails, 
        userProfile, 
        authToken, 
        fetchEmails, 
        () => {}
    );

    useEmailSync(settingsLoaded, fetchEmails);

    return {
        emails,
        stats,
        loading,
        isRefetching,
        error,
        fetchEmails,
        deleteEmails,
        deleteSingleEmail,
        setEmails
    };
};
