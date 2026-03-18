import { useState, useEffect, useCallback } from 'react';
import { AuthService, type UserProfile } from '../services/AuthService';
import { LocalStorageService } from '../services/LocalStorageService';
import { logger } from '../utils/logger';
import { useTranslation } from './useTranslation';
import { useAuthSync } from './useAuthSync';
import { CONSTANTS } from '../config/constants';
import type { TranslationKey } from '../types/i18n';

export interface AuthState {
    userProfile: UserProfile | null;
    authToken: string | null;
    authLoading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    authError: string | null;
    clearAuthError: () => void;
}

export const useAuth = () => {
    const { t } = useTranslation();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const { handlePostLoginSync } = useAuthSync();

    // Initial Auth Check
    useEffect(() => {
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkAuth = async () => {
        setAuthLoading(true);
        try {
            const token = await AuthService.getAuthToken(false).catch(() => null);
            if (token) {
                const profile = await AuthService.getUserProfile(token);
                const localEmails = await LocalStorageService.getEmails();

                if (localEmails.length > 0) {
                    const settings = await LocalStorageService.getSettings();
                    const lastLoggedInEmail = settings[CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL];

                    if (lastLoggedInEmail && lastLoggedInEmail !== profile.email) {
                        setAuthError(t('error_account_conflict'));
                        setUserProfile(profile);
                        setAuthToken(token);
                        setAuthLoading(false);
                        return;
                    }
                }

                // No conflict - proceed with auto-login
                setAuthToken(token);
                setUserProfile(profile);

                // Persistence for Background Script
                await LocalStorageService.setUserProfile(profile);
                await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL]: profile.email });
            }
        } catch {
            // Silent fail for auto-login
        } finally {
            setAuthLoading(false);
        }
    };

    const login = useCallback(async (): Promise<UserProfile | undefined> => {
        if (authLoading && !authError) {
            logger.warn('Login already in progress, ignoring concurrent request');
            return undefined;
        }

        setAuthError(null);
        setAuthLoading(true);
        try {
            // Step 1: Get Token
            let token = await AuthService.getAuthToken(true);
            setAuthToken(token);
            let profile: UserProfile;

            // Step 2: Fetch Profile
            try {
                profile = await AuthService.getUserProfile(token);
            } catch {
                await AuthService.removeCachedToken(token);
                token = await AuthService.getAuthToken(true);
                setAuthToken(token);
                profile = await AuthService.getUserProfile(token);
            }

            setUserProfile(profile);
            await LocalStorageService.setUserProfile(profile);

            // 1. Storage & Account Conflict Check (Client)
            const localEmails = await LocalStorageService.getEmails();
            if (localEmails.length > 0) {
                const settings = await LocalStorageService.getSettings();
                const lastLoggedInEmail = settings[CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL];

                if (lastLoggedInEmail && lastLoggedInEmail !== profile.email) {
                    throw new Error(t('error_account_conflict'));
                }
            }

            // 2. Post-Login Synchronization (Server Conflict, Migration, Sync)
            await handlePostLoginSync(profile, token);

            return profile;
        } catch (e: unknown) {
            const err = e as Error;
            // If we ALREADY have a valid profile/token from a concurrent successful attempt, 
            // don't overwrite it with a "Cancelled" error from a redundant popup.
            if (err.message?.includes('The user did not approve') || err.message?.includes('cancelled')) {
                if (userProfile && authToken) {
                    logger.log('Ignoring cancellation error for already authenticated session');
                    setAuthLoading(false);
                    return userProfile; // Return existing profile
                }
            }

            logger.error('Login failed', err);

            // Map known errors to translation keys
            let errorKey = 'error_login_failed';
            const msg = err.message || '';

            if (msg.includes(CONSTANTS.ERRORS.FETCH_PROFILE)) errorKey = 'error_profile_failed';
            else if (msg.includes(CONSTANTS.ERRORS.RETRIEVE_TOKEN)) errorKey = 'error_token_failed';
            else if (msg.includes(CONSTANTS.ERRORS.ACCOUNT_CONFLICT)) errorKey = 'error_account_conflict';
            else if (msg.includes(CONSTANTS.ERRORS.SYNC_FAILED)) errorKey = 'error_sync_failed';
            else if (msg.includes(CONSTANTS.ERRORS.NETWORK) || msg.includes(CONSTANTS.ERRORS.CUSTOM_CONTENT) === false && !navigator.onLine) errorKey = 'error_network';

            setAuthError(t(errorKey as TranslationKey));
            throw err;
        } finally {
            setAuthLoading(false);
        }
    }, [authLoading, authError, userProfile, authToken, t, handlePostLoginSync]);

    const logout = useCallback(async (clearData: boolean = false) => {
        const tokenToRevoke = authToken;
        const emailToPreserve = userProfile?.email;

        // 1. Persistence cleanup (Must happen BEFORE React state updates to avoid race conditions during re-renders)
        if (!clearData && emailToPreserve) {
            await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.CURRENT_USER]: emailToPreserve });
        }

        if (tokenToRevoke) {
            AuthService.logout(tokenToRevoke).catch(e => logger.warn('Revoke failed:', e));
        }

        try {
            await LocalStorageService.setUserProfile(null);
            if (clearData) {
                await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL]: null });
                await LocalStorageService.deleteAll();
            }
        } catch (e) {
            logger.warn('Logout storage cleanup failed:', e);
        }

        // 2. Atomic React State Reset
        setAuthToken(null);
        setUserProfile(null);
    }, [authToken, userProfile?.email]);

    return {
        userProfile,
        authToken,
        authLoading,
        login,
        logout,
        authError,
        clearAuthError: () => setAuthError(null)
    };
};

