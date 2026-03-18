import { LocalStorageService } from '../services/LocalStorageService';
import { CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger';
import type { TrackedEmail } from '../types';
import type { UserProfile } from '../services/AuthService';

export interface UseAppActionsProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: any) => string;
    login: () => Promise<UserProfile | undefined>;
    logout: (clearData: boolean) => Promise<void>;
    clearAuthError: () => void;
    userProfile: UserProfile | null;
    setCurrentUser: (user: string | null) => void;
    fetchEmails: () => Promise<void>;
    setEmails: React.Dispatch<React.SetStateAction<TrackedEmail[]>>;
    deleteSingleEmail: (id: string) => Promise<{ success: boolean; message?: string; type?: 'success' | 'warning' }>;
    showStatus: (title: string, msg: string, type: 'success' | 'warning' | 'danger') => void;
    selectedEmail: TrackedEmail | null;
    emailToDelete: TrackedEmail | null;
    setConflictEmail: (email: string | null) => void;
    setLogoutModalOpen: (open: boolean) => void;
    setEmailToDelete: (email: TrackedEmail | null) => void;
}

export const useAppActions = (props: UseAppActionsProps) => {
    const {
        t, login, logout, clearAuthError, userProfile, setCurrentUser,
        fetchEmails, setEmails, deleteSingleEmail, showStatus,
        selectedEmail, emailToDelete,
        setConflictEmail, setLogoutModalOpen, setEmailToDelete
    } = props;

    const handleLogin = async () => {
        try {
            await login();
        } catch {
            // Error handled via useAuth state
        }
    };

    const resolveConflict = async (wipeAll: boolean) => {
        try {
            if (wipeAll) {
                await LocalStorageService.deleteAll();
                setCurrentUser(null);
            } else {
                await LocalStorageService.deleteSyncedOnly();
            }

            await new Promise<void>((resolve) => {
                chrome.storage.local.remove([CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL], () => resolve());
            });
            clearAuthError();
            setConflictEmail(null);

            const profile = await login();

            if (profile && !wipeAll) {
                const allLocal = await LocalStorageService.getEmails();
                const ids = allLocal.map(e => e.id);
                if (ids.length > 0) {
                    await LocalStorageService.updateOwnership(ids, profile.email);
                    await fetchEmails();
                }
            }
        } catch (err: unknown) {
            const e = err as Error;
            showStatus(t('modal_status_resolution_failed'), e.message, 'danger');
        }
    };

    const handleLogoutClick = () => {
        setLogoutModalOpen(true);
    };

    const confirmLogout = async (clearData: boolean) => {
        await logout(clearData);
        if (clearData) {
            setCurrentUser(null);
            // Directly reset React state to avoid stale closure re-fetching from server
            setEmails([]);
        } else {
            if (userProfile?.email) {
                setCurrentUser(userProfile.email);
            }
            await fetchEmails();
        }
        setLogoutModalOpen(false);
    };

    const refreshSelectedEmail = async () => {
        if (!selectedEmail) return;
        try {
            await fetchEmails();
        } catch (err: unknown) {
            const e = err as Error;
            logger.error('Failed to refresh email', e);
        }
    };

    const handleDeleteSingleEmail = async () => {
        if (!emailToDelete) return;
        try {
            const result = await deleteSingleEmail(emailToDelete.id);
            if (result.success) {
                setEmailToDelete(null);
                if (result.message) {
                    showStatus(
                        result.type === 'warning' ? t('modal_status_note') : t('modal_status_deleted'),
                        result.message,
                        result.type || 'success'
                    );
                }
            } else {
                showStatus(t('modal_status_delete_failed'), result.message || t('error_unknown_error'), 'danger');
            }
        } catch (err: unknown) {
            const e = err as Error;
            showStatus(t('modal_status_delete_failed'), e.message, 'danger');
        }
    };

    return {
        handleLogin,
        resolveConflict,
        handleLogoutClick,
        confirmLogout,
        refreshSelectedEmail,
        handleDeleteSingleEmail
    };
};

