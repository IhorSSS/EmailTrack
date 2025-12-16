/**
 * API Configuration
 * Single source of truth for all API endpoints
 */

export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_URL || (() => {
        if (import.meta.env.PROD) {
            console.error('CRITICAL: VITE_API_URL is missing in production build!');
            return ''; // Fail secure/silent
        }
        return 'http://localhost:3000';
    })(),
    ENDPOINTS: {
        REGISTER: '/register',
        LOGIN: '/auth/login', // Google OAuth Login
        SYNC: '/auth/sync',   // Sync local data to cloud
        HEALTH: '/health',
        AUTH: '/auth',
        TRACK: '/track',     // Pixel tracking endpoint (base)
        PIXEL_PATH: '/track/track.gif', // Specific pixel path
        USER_INFO: '/auth/me', // Get current user info
        STATS: '/stats',
        DASHBOARD: '/dashboard',
        DELETE: '/track/history' // Delete email history
    },
    OAUTH: {
        AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
        CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID, // Must be provided in .env
        SCOPES: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        REDIRECT_URI: typeof chrome !== 'undefined' && chrome.identity
            ? `https://${chrome.runtime.id}.chromiumapp.org/`
            : window.location.origin,
        USER_INFO: 'https://www.googleapis.com/oauth2/v2/userinfo',
        REVOKE: 'https://oauth2.googleapis.com/revoke'
    },
    TIMEOUTS: {
        DEFAULT: 10000
    }
} as const;
