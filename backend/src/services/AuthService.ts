
import { OAuth2Client } from 'google-auth-library';
import { CONFIG } from '../config';
import { GoogleAuthInfo } from '../types';
import { UserService, IncomingEmail } from './UserService';
import { logger } from '../utils/logger';

const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const client = new OAuth2Client(CONFIG.GOOGLE.CLIENT_ID);

interface GoogleUserInfoResponse {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
}

export class AuthService {
    /**
     * Verifies a Google token (ID Token or OAuth2 Access Token).
     * chrome.identity.getAuthToken() returns an OAuth2 access token (ya29.xxx),
     * NOT a JWT ID token. This method handles both types gracefully.
     *
     * @param token - The token from the Authorization header.
     * @returns The user's Google profile information.
     */
    static async verifyGoogleToken(token: string): Promise<GoogleAuthInfo> {
        // Detect token type: JWT ID tokens have 3 dot-separated segments
        const isIdToken = token.split('.').length === 3;

        if (isIdToken) {
            return AuthService.verifyIdToken(token);
        }

        return AuthService.verifyAccessToken(token);
    }

    /**
     * Verifies a Google JWT ID Token via google-auth-library.
     */
    private static async verifyIdToken(token: string): Promise<GoogleAuthInfo> {
        try {
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: CONFIG.GOOGLE.CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.sub || !payload.email) {
                throw new Error('Invalid token payload');
            }

            return {
                id: payload.sub,
                email: payload.email,
                googleId: payload.sub,
                name: payload.name,
                picture: payload.picture
            };
        } catch (error) {
            logger.error('[AuthService] ID Token verification failed:', error);
            throw error;
        }
    }

    /**
     * Verifies a Google OAuth2 Access Token via Google's userinfo endpoint.
     * Used for tokens from chrome.identity.getAuthToken().
     */
    private static async verifyAccessToken(token: string): Promise<GoogleAuthInfo> {
        try {
            const response = await fetch(GOOGLE_USERINFO_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error(`Google userinfo returned ${response.status}`);
            }

            const userInfo = await response.json() as GoogleUserInfoResponse;

            if (!userInfo.sub || !userInfo.email) {
                throw new Error('Invalid userinfo response: missing sub or email');
            }

            return {
                id: userInfo.sub,
                email: userInfo.email,
                googleId: userInfo.sub,
                name: userInfo.name,
                picture: userInfo.picture
            };
        } catch (error) {
            logger.error('[AuthService] Access Token verification failed:', error);
            throw error;
        }
    }

    /**
     * Synchronizes local data for a user upon login.
     * @param googleId - The user's Google ID.
     * @param email - The user's primary email.
     * @param localEmails - Array of email data to sync.
     */
    static async syncUserData(googleId: string, email: string, localEmails: IncomingEmail[]) {
        const userId = await UserService.resolveUserFromAuth(googleId, email);
        if (!userId) {
            throw new Error('Failed to resolve user account');
        }

        // Logic for batch linking
        return await UserService.batchLinkEmails(userId, localEmails);
    }
}
