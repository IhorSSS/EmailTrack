/**
 * API Configuration
 * Single source of truth for all API endpoints
 */

export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_API_URL || 'https://emailtrack.isnode.pp.ua',
    ENDPOINTS: {
        REGISTER: '/register',
        TRACK: '/track/img.png', // Changed to img.png to avoid blockers
        DASHBOARD: '/dashboard',
        STATS: '/stats'
    },
    PARAMS: {
        DASHBOARD_LIMIT: 1000  // High limit to get all emails
    }
} as const;
