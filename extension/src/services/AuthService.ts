import { API_CONFIG } from '../config/api';
import { logger } from '../utils/logger';

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
                if (chrome.runtime?.lastError) {
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
     * Remove a token from Chrome's cache (Invalidate)
     */
    static async removeCachedToken(token: string): Promise<void> {
        return new Promise((resolve) => {
            if (!chrome.identity) return resolve();
            chrome.identity.removeCachedAuthToken({ token }, () => resolve());
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
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`;
        logger.log('[AuthService] syncUser calling:', url);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, googleId, token })
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('[AuthService] syncUser failed:', response.status, errorText);
                throw new Error(`Sync failed: ${response.status}`);
            }

            logger.log('[AuthService] syncUser success');
        } catch (e) {
            logger.error('[AuthService] syncUser error:', e);
            throw e; // Re-throw so caller knows sync failed
        }
    }

    /**
     * Check if local email IDs are owned by another user
     */
    static async checkOwnershipConflict(emailIds: string[], googleId: string, token: string): Promise<boolean> {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH}/check-conflicts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ googleId, emailIds })
        });

        if (!response.ok) {
            console.error('Failed to check ownership conflicts (API Error)');
            return false;
        }

        const data = await response.json();
        return data.conflict;
    }

    /**
     * Upload local history to backend (Batch Sync)
     */
    static async uploadHistory(emails: any[], googleId: string, email: string, token: string): Promise<number> {
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SYNC}`;
        logger.log('[AuthService] uploadHistory calling:', url, 'with', emails.length, 'emails');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ googleId, email, emails })
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('[AuthService] uploadHistory failed:', response.status, errorText);
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data = await response.json();
            logger.log('[AuthService] uploadHistory success, count:', data.count);
            return data.count || 0;
        } catch (e) {
            logger.error('[AuthService] uploadHistory error:', e);
            throw e;
        }
    }
}
