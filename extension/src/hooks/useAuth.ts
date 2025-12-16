import { useState, useEffect, useCallback } from 'react';
import { AuthService, type UserProfile } from '../services/AuthService';
import { LocalStorageService } from '../services/LocalStorageService';

export interface AuthState {
    userProfile: UserProfile | null;
    authToken: string | null;
    authLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    authError: string | null;
}

export const useAuth = () => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    // Initial Auth Check
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        setAuthLoading(true);
        try {
            const token = await AuthService.getAuthToken(false).catch(() => null);
            if (token) {
                setAuthToken(token);
                const profile = await AuthService.getUserProfile(token);
                setUserProfile(profile);

                // Persistence for Background Script
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ userProfile: profile });
                }
            }
        } catch (e) {
            console.log('Auto-login failed / Not logged in', e);
        } finally {
            setAuthLoading(false);
        }
    };

    const login = useCallback(async () => {
        setAuthError(null);
        try {
            const token = await AuthService.getAuthToken(true);
            setAuthToken(token);
            let profile: UserProfile;
            try {
                profile = await AuthService.getUserProfile(token);
                setUserProfile(profile);
                chrome.storage.local.set({ userProfile: profile });
            } catch (err) {
                throw new Error('Failed to fetch user profile');
            }

            // 1. Conflict Check
            const localEmails = await LocalStorageService.getEmails();
            const localIds = localEmails.map(e => e.id);

            if (localIds.length > 0) {
                const hasConflict = await AuthService.checkOwnershipConflict(localIds, profile.id, token);
                if (hasConflict) {
                    await logout(); // Abort
                    throw new Error(`Account Conflict: Local history belongs to another account. Please clear history first.`);
                }
            }

            // 2. Sync User
            await AuthService.syncUser(profile.email, profile.id, token);

            // 3. Upload Local History (Merge)
            const unsynced = localEmails.filter(e => !e.synced);
            if (unsynced.length > 0) {
                try {
                    const count = await AuthService.uploadHistory(unsynced, profile.id, profile.email, token);
                    if (count > 0) {
                        await LocalStorageService.markAsSynced(unsynced.map(e => e.id));
                    }
                } catch (syncErr) {
                    console.warn('History upload failed:', syncErr);
                }
            }
        } catch (e: any) {
            console.error('Login failed', e);
            setAuthError(e.message || 'Login failed');
            throw e; // Re-throw for UI to handle (e.g. show modal)
        }
    }, []);

    const logout = useCallback(async () => {
        if (authToken) {
            await AuthService.logout(authToken);
        }
        setAuthToken(null);
        setUserProfile(null);
        // Clear persistence
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['userProfile']);
        }
    }, [authToken]);

    return {
        userProfile,
        authToken,
        authLoading,
        login,
        logout,
        authError
    };
};
