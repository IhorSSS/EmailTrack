import { API_CONFIG } from '../config/api';

export interface UserProfile {
    id: string; // Google ID
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

export class AuthService {
    /**
     * Authenticate with Google and get the Access Token
     */
    static async getAuthToken(interactive: boolean = true): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!chrome.identity) {
                reject(new Error('Extension context invalidated or identity API unavailable'));
                return;
            }
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError) {
                    // Start interactive flow if non-interactive failed? 
                    // Usually caller handles it by passing interactive=true
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (token) {
                    resolve(token as string);
                } else {
                    reject(new Error('Failed to retrieve token'));
                }
            });
        });
    }

    /**
     * Fetch User Profile from Google using Access Token
     */
    static async getUserProfile(token: string): Promise<UserProfile> {
        const response = await fetch(API_CONFIG.OAUTH.USER_INFO, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        return await response.json();
    }

    /**
     * Logout: Remove cached token and clear local state
     */
    static async logout(token: string): Promise<void> {
        return new Promise((resolve) => {
            if (!chrome.identity) {
                resolve();
                return;
            }

            // 1. Revoke token to force account selection next time
            // Using POST is more standard for newer endpoints
            const revokeUrl = API_CONFIG.OAUTH.REVOKE;

            fetch(revokeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString()
            })
                .then(async (res) => {
                    if (res.ok) {
                        console.log('Token revoked successfully');
                    } else {
                        console.warn('Token revocation failed:', res.status, await res.text());
                    }
                })
                .catch((err) => {
                    console.error('Token revocation network error:', err);
                })
                .finally(() => {
                    // 2. Remove from Chrome Identity Cache
                    chrome.identity.removeCachedAuthToken({ token }, () => {
                        console.log('Token removed from cache');

                        // 3. Clear Local Storage 'currentUser' to prevent UI stickiness
                        chrome.storage.local.remove(['currentUser'], () => {
                            resolve();
                        });
                    });
                });
        });
    }

    /**
     * Sync user with backend (Create or Update)
     */
    static async syncUser(email: string, googleId: string, token: string): Promise<void> {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, googleId, token })
        });
        if (!response.ok) {
            // We don't want to block login if sync fails (e.g. offline), but good to know
            console.warn('Failed to sync user with backend');
        }
    }

    /**
     * Check if local email IDs are owned by another user
     */
    static async checkOwnershipConflict(emailIds: string[], googleId: string): Promise<boolean> {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/check-conflicts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ googleId, emailIds })
        });

        if (!response.ok) {
            // If check fails technically, we might want to block or allow?
            // Safer to allow (fail open) or block (fail closed)? 
            // Let's assume fail open for now but log error, or fail closed to be safe?
            console.error('Failed to check ownership conflicts');
            return false;
        }

        const data = await response.json();
        return data.conflict;
    }

    /**
     * Upload local history to backend (Batch Sync)
     */
    static async uploadHistory(emails: any[], googleId: string, email: string): Promise<number> {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SYNC}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ googleId, email, emails })
        });

        if (!response.ok) {
            throw new Error('Failed to upload history');
        }

        const data = await response.json();
        return data.count || 0;
    }
}
