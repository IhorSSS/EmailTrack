
import { OAuth2Client } from 'google-auth-library';
import { CONFIG } from '../config';

const client = new OAuth2Client(CONFIG.GOOGLE.CLIENT_ID);

export async function verifyGoogleToken(token: string): Promise<string> {
    try {
        // chrome.identity.getAuthToken returns an Access Token, not an ID Token.
        // We use getTokenInfo to verify it.
        const tokenInfo = await client.getTokenInfo(token);

        // Optional: specific audience check if critical, but Access Tokens 
        // for Chrome Extensions might have varying audiences or just be valid for the project.
        // We trust Google's validation of the token string itself.

        if (!tokenInfo.sub) {
            throw new Error('Invalid token payload');
        }
        return tokenInfo.sub; // This is the googleId
    } catch (error) {
        console.error('Token verification failed:', error);
        throw new Error('Token verification failed');
    }
}
