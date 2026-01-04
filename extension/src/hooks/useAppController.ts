import { useState, useEffect } from 'react';
import type { TrackedEmail } from '../types';
import { useAuth } from './useAuth';
import { useEmails } from './useEmails';
import { useFilteredEmails } from './useFilteredEmails';
import { useExtensionSettings } from './useExtensionSettings';
import { useStatusModal } from './useStatusModal';
import { useHistoryManager } from './useHistoryManager';
import { LocalStorageService } from '../services/LocalStorageService';

export const useAppController = () => {
    const [view, setView] = useState<'dashboard' | 'activity' | 'settings'>('dashboard');
    const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);

    // -- HOOKS --
    const { userProfile, authLoading, login, logout, authError, authToken, clearAuthError } = useAuth();
    const {
        currentUser, setCurrentUser,
        globalEnabled, toggleGlobal,
        bodyPreviewLength, setBodyPreviewLength,
        theme, setTheme, settingsLoaded
    } = useExtensionSettings();
    const { statusModal, showStatus, closeStatus } = useStatusModal();

    // -- EFFECTS --
    // Automatically sync global identity state with auth profile
    useEffect(() => {
        // Sync currentUser (guest/local ID) with auth profile email when logged in
        if (userProfile?.email && userProfile.email !== currentUser) {
            setCurrentUser(userProfile.email);
        }
        // If profile is gone, we DON'T automatically clear currentUser here 
        // because we might be in "Keep Data" mode (Anonymous Session).
        // Clearing currentUser is handled explicitly in logout(true) or deleteHistory.
    }, [userProfile, currentUser, setCurrentUser]);

    const { emails, loading: dataLoading, error: dataError, fetchEmails, deleteEmails } = useEmails(userProfile, currentUser, authToken, settingsLoaded);

    const {
        searchQuery, setSearchQuery,
        filterType, setFilterType,
        senderFilter, setSenderFilter,
        uniqueSenders, processedEmails,
        stats: filteredStats
    } = useFilteredEmails(emails);

    const { handleDeleteHistory } = useHistoryManager(
        deleteEmails,
        senderFilter,
        userProfile,
        showStatus,
        setCurrentUser,
        currentUser
    );

    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [conflictEmail, setConflictEmail] = useState<string | null>(null);

    // Sync conflict status from Auth hook
    useEffect(() => {
        if (authError?.includes('Account Conflict')) {
            setConflictEmail('another account');
        } else if (!authError) {
            setConflictEmail(null);
        }
    }, [authError]);

    const handleLogin = async () => {
        if (authLoading) return;
        try {
            await login();
        } catch (e: any) {
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

            // CRITICAL fix for "Ghost Data" after Account Switch:
            // If we kept data (!wipeAll), it still belongs to the OLD user in the DB (local storage).
            // We need to re-tag it to the NEW user upon successful login, otherwise strict identity filter hides it.

            // 1. Clear blocker
            await new Promise<void>((resolve) => {
                chrome.storage.local.remove(['lastLoggedInEmail'], () => resolve());
            });
            clearAuthError();
            setConflictEmail(null);

            // 2. Re-login and MIGRATE data if successful
            const profile = await login(); // Ensure useAuth.login returns profile!

            if (profile && !wipeAll) {
                // We kept local data, now we must adopt it for the new user
                const allLocal = await LocalStorageService.getEmails();
                const ids = allLocal.map(e => e.id);
                if (ids.length > 0) {
                    await LocalStorageService.updateOwnership(ids, profile.email);
                    // Refresh to show migrated data
                    await fetchEmails();
                }
            }
        } catch (e: any) {
            showStatus('Resolution/Login Failed', e.message, 'danger');
        }
    };

    const activeIdentity = userProfile ? userProfile.email : currentUser;
    const loading = authLoading || dataLoading;
    const dataOnlyError = dataError; // For views that only need data error

    const handleLogoutClick = () => {
        setLogoutModalOpen(true);
    };

    const confirmLogout = async (clearData: boolean) => {
        if (clearData) {
            setCurrentUser(null);
        }
        await logout(clearData);
        setLogoutModalOpen(false);
    };

    const refreshSelectedEmail = async () => {
        if (!selectedEmail) return;

        try {
            // Re-fetch all or at least trigger a global sync
            await fetchEmails();
        } catch (e: any) {
            console.error('Failed to refresh email', e);
        }
    };

    // Effect to update selectedEmail when emails list changes
    // This ensures that after fetchEmails, the detail view sees the latest data
    const selectedId = selectedEmail?.id;
    const latestSelected = emails.find(e => e.id === selectedId);
    if (selectedId && latestSelected && latestSelected !== selectedEmail) {
        setSelectedEmail(latestSelected);
    }

    return {
        state: {
            view,
            selectedEmail,
            userProfile,
            loading,
            error: dataOnlyError,
            authError,
            activeIdentity,
            stats: filteredStats,
            uniqueSenders,
            senderFilter,
            searchQuery,
            filterType,
            processedEmails,
            statusModal,
            globalEnabled,
            bodyPreviewLength,
            logoutModalOpen,
            deleteConfirmModalOpen,
            conflictEmail,
            theme
        },
        actions: {
            setView,
            setSelectedEmail,
            handleLogin,
            logout: handleLogoutClick, // Override standard logout with modal trigger
            confirmLogout, // Actual logout action
            closeLogoutModal: () => setLogoutModalOpen(false),
            fetchEmails,
            setSenderFilter,
            setSearchQuery,
            setFilterType,
            toggleGlobal,
            setBodyPreviewLength,
            handleDeleteHistory,
            refreshSelectedEmail,
            closeStatus,
            setCurrentUser,
            clearAuthError,
            setTheme,
            resolveConflict,
            closeConflict: () => setConflictEmail(null),
            openDeleteConfirm: () => setDeleteConfirmModalOpen(true),
            closeDeleteConfirm: () => setDeleteConfirmModalOpen(false)
        }
    };
};
