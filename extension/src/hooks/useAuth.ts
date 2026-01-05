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
    clearAuthError: () => void;
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
                const profile = await AuthService.getUserProfile(token);

                // CONFLICT CHECK (same as in login flow)
                const localEmails = await LocalStorageService.getEmails();

                if (localEmails.length > 0) {
                    // Check lastLoggedInEmail
                    const lastLoggedInEmail = await new Promise<string | null>((resolve) => {
                        chrome.storage.local.get(['lastLoggedInEmail'], (result: { lastLoggedInEmail?: string }) => {
                            resolve(result.lastLoggedInEmail || null);
                        });
                    });


                    if (lastLoggedInEmail && lastLoggedInEmail !== profile.email) {
                        // Different account detected. We DON'T logout, but we signal the conflict.
                        // For privacy, we don't reveal the email in the generic error.
                        setAuthError(`Account Conflict: Local history belongs to another account`);
                        // We still set the profile so App.tsx knows who is TRYING to log in
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
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ userProfile: profile, lastLoggedInEmail: profile.email });
                }
            }
        } catch (e) {
            // Silent fail for auto-login
        } finally {
            setAuthLoading(false);
        }
    };

    const login = useCallback(async (): Promise<UserProfile | undefined> => {
        if (authLoading && !authError) {
            console.warn('Login already in progress, ignoring concurrent request');
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
            } catch (err: any) {
                await AuthService.removeCachedToken(token);
                token = await AuthService.getAuthToken(true);
                setAuthToken(token);
                profile = await AuthService.getUserProfile(token);
            }

            setUserProfile(profile);
            chrome.storage.local.set({ userProfile: profile });

            // 1. Account Conflict Check (Client)
            const localEmails = await LocalStorageService.getEmails();
            if (localEmails.length > 0) {
                const lastLoggedInEmail = await new Promise<string | null>((resolve) => {
                    chrome.storage.local.get(['lastLoggedInEmail'], (result: { lastLoggedInEmail?: string }) => {
                        resolve(result.lastLoggedInEmail || null);
                    });
                });

                if (lastLoggedInEmail && lastLoggedInEmail !== profile.email) {
                    throw new Error(`Account Conflict: Local history belongs to another account`);
                }
            }

            // 2. Server Conflict Check
            const localIds = localEmails.map(e => e.id);
            if (localIds.length > 0) {
                const hasConflict = await AuthService.checkOwnershipConflict(localIds, profile.id, token);
                if (hasConflict) {
                    throw new Error(`Account Conflict: Local history belongs to another account`);
                }
            }

            // 3. Sync & Upload
            await AuthService.syncUser(profile.email, profile.id, token);

            // FRESH FETCH: Get all emails including those tracked during login popup
            const freshLocalEmails = await LocalStorageService.getEmails();

            if (freshLocalEmails.length > 0) {
                try {
                    const count = await AuthService.uploadHistory(freshLocalEmails, profile.id, profile.email, token);
                    if (count > 0) {
                        await LocalStorageService.markAsSynced(freshLocalEmails.map(e => e.id));
                    }
                    // CRITICAL: Ensure local identity is updated for filtered views
                    await LocalStorageService.updateOwnership(freshLocalEmails.map(e => e.id), profile.email);
                } catch (syncErr) {
                    console.warn('History upload failed:', syncErr);
                }
            }

            chrome.storage.local.set({ lastLoggedInEmail: profile.email });
            return profile; // RETURN PROFILE
        } catch (e: any) {
            // If we ALREADY have a valid profile/token from a concurrent successful attempt, 
            // don't overwrite it with a "Cancelled" error from a redundant popup.
            if (e.message?.includes('The user did not approve') || e.message?.includes('cancelled')) {
                if (userProfile && authToken) {
                    console.log('Ignoring cancellation error for already authenticated session');
                    setAuthLoading(false);
                    return userProfile; // Return existing profile
                }
            }

            console.error('Login failed', e);
            setAuthError(e.message || 'Login failed');
            throw e;
        } finally {
            setAuthLoading(false);
        }
    }, [authLoading, authError, userProfile, authToken]);

    const logout = useCallback(async (clearData: boolean = false) => {
        // 1. Atomic State Reset (Synchrously reset React state to prevent race conditions)
        const tokenToRevoke = authToken;
        const emailToPreserve = userProfile?.email; // Capture before clearing
        setAuthToken(null);
        setUserProfile(null);

        // CRITICAL: If keeping data, save email as currentUser for Anonymous Mode filtering
        if (!clearData && emailToPreserve && typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.set({ currentUser: emailToPreserve });
        }

        // Check context validity before proceeding
        const isContextValid = typeof chrome !== 'undefined' &&
            chrome.runtime &&
            chrome.runtime.id;

        // 2. Async Cleanup
        if (tokenToRevoke && isContextValid) {
            try {
                // Background revoke (don't block UI state update)
                AuthService.logout(tokenToRevoke).catch(e => console.warn('Revoke failed:', e));
            } catch (e) {
                console.warn('Logout service call failed (context may be invalid):', e);
            }
        }

        // Clear persistence only if context is valid
        if (isContextValid && chrome.storage && chrome.storage.local) {
            try {
                await new Promise<void>((resolve) => {
                    // Always remove userProfile, optionally remove lastLoggedInEmail
                    const keysToRemove = clearData
                        ? ['userProfile', 'lastLoggedInEmail']
                        : ['userProfile'];

                    chrome.storage.local.remove(keysToRemove, () => {
                        if (chrome.runtime.lastError) {
                            console.warn('Storage remove failed:', chrome.runtime.lastError);
                        }
                        resolve();
                    });
                });

                if (clearData) {
                    await LocalStorageService.deleteAll();
                }
            } catch (e) {
                console.warn('Logout storage cleanup failed (context may be invalid):', e);
            }
        }
    }, [authToken]);

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
