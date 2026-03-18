import { useState, useEffect } from 'react';
import type { TrackedEmail } from '../types';
import { useAuth } from './useAuth';
import { useEmails } from './useEmails';
import { useFilteredEmails } from './useFilteredEmails';
import { useExtensionSettings } from './useExtensionSettings';
import { useStatusModal } from './useStatusModal';
import { useHistoryManager } from './useHistoryManager';
import { useTranslation } from './useTranslation';
import { useAppActions } from './useAppActions';

export const useAppController = () => {
    const { t } = useTranslation();
    const [view, setView] = useState<'dashboard' | 'activity' | 'settings'>('dashboard');
    const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);

    // -- HOOKS --
    const { userProfile, authLoading, login, logout, authError, authToken, clearAuthError } = useAuth();
    const {
        currentUser, setCurrentUser,
        globalEnabled, toggleGlobal,
        bodyPreviewLength, setBodyPreviewLength,
        showTrackingIndicator, setShowTrackingIndicator,
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

    const {
        emails, loading: dataLoading, error: dataError,
        fetchEmails, deleteEmails, deleteSingleEmail
    } = useEmails(userProfile, currentUser, authToken, settingsLoaded);

    const {
        searchQuery, setSearchQuery,
        filterType, setFilterType,
        senderFilter, setSenderFilter,
        uniqueSenders, processedEmails, senderFilteredEmails,
        stats: filteredStats
    } = useFilteredEmails(emails);

    const { handleDeleteHistory } = useHistoryManager(
        deleteEmails,
        senderFilter,
        setSenderFilter,
        userProfile,
        showStatus,
        setCurrentUser,
        currentUser
    );

    const [logoutModalOpen, setLogoutModalOpen] = useState(false);
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
    const [conflictEmail, setConflictEmail] = useState<string | null>(null);
    const [emailToDelete, setEmailToDelete] = useState<TrackedEmail | null>(null);

    // Sync conflict status from Auth hook
    useEffect(() => {
        if (authError?.includes('Account Conflict')) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setConflictEmail('another account');
        } else if (!authError) {
            setConflictEmail(null);
        }
    }, [authError]);

    const activeIdentity = userProfile ? userProfile.email : currentUser;
    const loading = authLoading || dataLoading;
    const dataOnlyError = dataError;

    const {
        handleLogin,
        resolveConflict,
        handleLogoutClick,
        confirmLogout,
        refreshSelectedEmail,
        handleDeleteSingleEmail
    } = useAppActions({
        t,
        login,
        logout,
        clearAuthError,
        userProfile,
        setCurrentUser,
        fetchEmails,
        deleteSingleEmail,
        showStatus,
        selectedEmail,
        emailToDelete,
        setConflictEmail,
        setLogoutModalOpen,
        setEmailToDelete
    });

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
            senderFilteredEmails,
            statusModal,
            globalEnabled,
            bodyPreviewLength,
            logoutModalOpen,
            deleteConfirmModalOpen,
            conflictEmail,
            emailToDelete,
            theme,
            showTrackingIndicator
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
            closeDeleteConfirm: () => setDeleteConfirmModalOpen(false),
            openDeleteSingleConfirm: (email: TrackedEmail) => setEmailToDelete(email),
            closeDeleteSingleConfirm: () => setEmailToDelete(null),
            handleDeleteSingleEmail,
            setShowTrackingIndicator
        }
    };
};
