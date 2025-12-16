
import { useState } from 'react';
import type { TrackedEmail } from '../types';
import { useAuth } from './useAuth';
import { useEmails } from './useEmails';
import { useFilteredEmails } from './useFilteredEmails';
import { useExtensionSettings } from './useExtensionSettings';
import { useStatusModal } from './useStatusModal';
import { useHistoryManager } from './useHistoryManager';

export const useAppController = () => {
    const [view, setView] = useState<'dashboard' | 'activity' | 'settings'>('dashboard');
    const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);

    // -- HOOKS --
    const { userProfile, authLoading, login, logout, authError, authToken } = useAuth();
    const {
        currentUser, setCurrentUser,
        globalEnabled, toggleGlobal,
        bodyPreviewLength, setBodyPreviewLength
    } = useExtensionSettings();
    const { statusModal, showStatus, closeStatus } = useStatusModal();

    const { emails, stats, loading: dataLoading, error: dataError, fetchEmails, deleteEmails } = useEmails(userProfile, currentUser, authToken);

    const {
        searchQuery, setSearchQuery,
        filterType, setFilterType,
        senderFilter, setSenderFilter,
        uniqueSenders, processedEmails
    } = useFilteredEmails(emails);

    const { handleDeleteHistory } = useHistoryManager(
        deleteEmails,
        senderFilter,
        userProfile,
        showStatus,
        setCurrentUser
    );

    const handleLogin = async () => {
        try {
            await login();
        } catch (e: any) {
            showStatus('Login Failed', e.message || 'Could not sign in.', 'danger');
        }
    };

    const activeIdentity = userProfile ? userProfile.email : currentUser;
    const loading = authLoading || dataLoading;
    const error = authError || dataError;

    return {
        state: {
            view,
            selectedEmail,
            userProfile,
            loading,
            error,
            activeIdentity,
            stats,
            uniqueSenders,
            senderFilter,
            searchQuery,
            filterType,
            processedEmails,
            statusModal,
            globalEnabled,
            bodyPreviewLength
        },
        actions: {
            setView,
            setSelectedEmail,
            handleLogin,
            logout,
            fetchEmails,
            setSenderFilter,
            setSearchQuery,
            setFilterType,
            toggleGlobal,
            setBodyPreviewLength,
            handleDeleteHistory,
            closeStatus,
            setCurrentUser
        }
    };
};
