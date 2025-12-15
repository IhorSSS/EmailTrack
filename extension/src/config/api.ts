/**
 * API Configuration
 * Single source of truth for all API endpoints
 */

export const API_CONFIG = {
    BASE_URL: 'https://emailtrack.isnode.pp.ua',

    ENDPOINTS: {
        DASHBOARD: '/dashboard',
        REGISTER: '/register',
        STATS: '/stats',
        TRACK_PIXEL: '/track/track.gif'
    },

    PARAMS: {
        DASHBOARD_LIMIT: 1000
    }
} as const;
