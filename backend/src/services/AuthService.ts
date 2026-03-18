
import { OAuth2Client } from 'google-auth-library';
import { CONFIG } from '../config';
import { GoogleAuthInfo } from '../types';
import { UserService, IncomingEmail } from './UserService';
import { logger } from '../utils/logger';

const client = new OAuth2Client(CONFIG.GOOGLE.CLIENT_ID);

export class AuthService {
    /**
     * Verifies a Google ID Token.
     * @param token - The token from the Authorization header.
     * @returns The user's Google profile information.
     */
    static async verifyGoogleToken(token: string): Promise<GoogleAuthInfo> {
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
            logger.error('[AuthService] Token verification failed:', error);
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
