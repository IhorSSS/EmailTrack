/**
 * API Configuration
 * Single source of truth for all API endpoints
 */

export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_URL || 'https://emailtrack.isnode.pp.ua',
    ENDPOINTS: {
        REGISTER: '/register',
        LOGIN: '/auth/login',
        SYNC: '/auth/sync',
        AUTH: '/auth',
        TRACK: '/track/img.png', // Changed to img.png to avoid blockers
        DASHBOARD: '/dashboard',
        STATS: '/stats'
    },
    PARAMS: {
        DASHBOARD_LIMIT: 1000
    },
    OAUTH: {
        USER_INFO: 'https://www.googleapis.com/oauth2/v2/userinfo',
        REVOKE: 'https://oauth2.googleapis.com/revoke'
    },
    TIMEOUTS: {
        DEFAULT: 10000
    }
} as const;
