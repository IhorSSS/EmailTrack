/**
 * Application Constants
 * Time windows, thresholds, limits, and magic numbers
 */

export const CONSTANTS = {
    // Time windows
    GROUPING_WINDOW_MS: 10 * 60 * 1000, // 10 minutes in milliseconds

    // Popup dimensions and positioning
    POPUP: {
        WIDTH: 320,
        HEIGHT: 300,
        OFFSET: 8
    },

    // Dashboard
    DASHBOARD_RECENT_COUNT: 3,

    // Retry logic
    RETRY: {
        ATTEMPTS: 5,
        DELAY_MS: 500
    },

    // Content Script
    CONTENT: {
        CONFIG_SYNC_DELAY_MS: 2000,
        CONFIG_HEARTBEAT_MS: 2000,
        INJECTION_DELAY_MS: 200
    }
} as const;
