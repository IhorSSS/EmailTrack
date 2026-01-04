
import { OAuth2Client } from 'google-auth-library';
import { CONFIG } from '../config';

const client = new OAuth2Client(CONFIG.GOOGLE.CLIENT_ID);

export interface GoogleAuthInfo {
    googleId: string;
    email?: string;
}

export async function verifyGoogleToken(token: string): Promise<GoogleAuthInfo> {
    try {
        const tokenInfo = await client.getTokenInfo(token);

        if (!tokenInfo.sub) {
            throw new Error('Invalid token payload');
        }

        return {
            googleId: tokenInfo.sub,
            email: tokenInfo.email
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        throw new Error('Token verification failed');
    }
}
