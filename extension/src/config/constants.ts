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
        INJECTION_DELAY_MS: 200,
        BADGE_INJECTION_RETRY_MS: 500,
        BADGE_INJECTION_MAX_ATTEMPTS: 5
    },

    // Injected DOM Dimensions
    DIMENSIONS: {
        DIODE_SIZE: '10px',
        DIODE_BORDER: '2px',
        DIODE_SHADOW_BLUR: '6px'
    },

    // Timeouts and Intervals (ms)
    TIMEOUTS: {
        CONFIG_READY: 100,
        INJECTION_DELAY: 500,
        API_RETRY_BASE: 1000,
        MAX_API_WAIT: 10000,
        YIELD: 100,
        THREADLIST_CACHE_MS: 2000,
        DEBOUNCE: 500
    },

    INTERVALS: {
        HEARTBEAT: 10000,
        HEARTBEAT_THRESHOLD_MS: 10000,
        RETRY_REGISTRATION_MIN: 5,
        POLLING_MS: 30000
    },

    CHUNKS: {
        FETCH_SIZE: 1000
    },

    LAYOUT: {
        ICON_SIZE_SMALL: 16,
        ICON_SIZE_TINY: 12,
        STATS_MIN_SPACE: 300,
        POPUP_PADDING: 20
    },

    // Semantic Colors (Shared across Contexts)
    COLORS: {
        SUCCESS: '#10b981',
        DANGER: '#ef4444',
        WARNING: '#f59e0b',
        WHITE: '#ffffff'
    },

    // Gmail-specific Selectors (Systemic Centralization)
    GMAIL_SELECTORS: {
        MESSAGE_ROW: 'div.adn',
        MESSAGE_BODY: '.a3s',
        MESSAGE_SENDER_SPAN: 'span.gD',
        MESSAGE_DATE_EL: '.gH',
        MESSAGE_SUBJECT_H2: 'h2.hP',
        USER_EMAIL: '.gb_Ha.gb_i, [aria-label*="@"]',
        COMPOSE_EDITABLE: 'div[contenteditable="true"][role="textbox"]',
        
        // Threadlist (Inbox/Sent/etc)
        THREAD_ROW: '.zA',
        USER_EMAIL_ACCOUNT_SWITCHER: '.gb_A', // Account switcher area
        GMAIL_ACCOUNT_SWITCHER_SELECTOR: 'a[aria-label*="Google Account:"]',
        THREAD_SUBJECT: 'span.bog',
        THREAD_DATE: 'td.xW.xY',
        THREAD_STATUS_CONTAINER: 'td.apU', // Column with star/etc, good for our checkmarks

        COMPOSE_DIALOG: '[role="dialog"]',
        COMPOSE_FORM: '[role="dialog"] form, td.Bu form',
        SEND_BUTTONS: [
            '[role="button"][aria-label^="Send"]',
            '[role="button"][aria-label^="Надіслати"]',
            '[role="button"][data-tooltip^="Send"]',
            '[role="button"][data-tooltip^="Надіслати"]',
            '.aoO',
            '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3'
        ],
        INDICATOR_ANCHORS: ['.dC', '.HP', '[role="group"]'],
        COMPONENTS: {
            LEGACY_COMPOSE_TD: 'td.Bu',
            LEGACY_COMPOSE_M9: '.M9',
            LEGACY_COMPOSE_AOI: '.aoI',
            LEGACY_COMPOSE_A9N: '.a9n'
        }
    },

    // Extension Message Types
    MESSAGES: {
        REGISTER_EMAIL: 'REGISTER_EMAIL',
        GET_STATS: 'GET_STATS',
        CONFIG_SYNC: 'CONFIG_SYNC',
        EMAILTRACK_REGISTER: 'EMAILTRACK_REGISTER'
    },

    // Storage Keys
    STORAGE_KEYS: {
        CURRENT_USER: 'currentUser',
        USER_PROFILE: 'userProfile',
        LAST_LOGGED_IN_EMAIL: 'lastLoggedInEmail',
        TRACKING_ENABLED: 'trackingEnabled',
        BODY_PREVIEW_LENGTH: 'bodyPreviewLength',
        THEME: 'theme',
        SHOW_TRACKING_INDICATOR: 'showTrackingIndicator',
        PENDING_DELETES: 'pending_deletes',
        LOCAL_HISTORY: 'emailtrack_local_history',
        LANGUAGE: 'language'
    },

    // Background Alarms
    ALARMS: {
        RETRY_REGISTRATION: 'retry_registration'
    },

    // Regex Centralization
    REGEX: {
        TRACKING_ID: /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
        TRACKING_ID_V2: /\/track\/([a-f0-9-]{36})/,
        GMAIL_ID: /#msg-(?:f|a):([a-f0-9]+)/i,
        SUBJECT_CLEANUP: /^(Re|Fwd|Re: |Fwd: |re: |fwd: )+/i,
        GMAIL_IDENTITY_LABEL: /\(([^)]+)\)/,
        GMAIL_IDENTITY_TITLE: / - ([^ ]+@[^ ]+) - /
    },

    // Trusted Types
    SECURITY: {
        TRUSTED_TYPES_POLICY: 'emailTrackPolicy'
    },

    // Gmail Events
    GMAIL_EVENTS: {
        SEND_MESSAGE: 'send_message',
        COMPOSE_MODAL: 'compose_modal'
    },

    // Script Filenames
    CORE_SCRIPTS: ['jquery.js', 'gmail.js', 'logic.js'],

    // UI Placeholders and Labels
    UI: {
        UNKNOWN_SENDER: 'Unknown',
        SUBJECT_UNAVAILABLE: 'Subject Unavailable',
        FETCH_LIMIT: 1000,
        FILTER_ALL: 'all'
    },

    // HTTP Status Codes
    STATUS: {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        INTERNAL_ERROR: 500
    },

    // Known Error Strings for Matching
    ERRORS: {
        FETCH_PROFILE: 'Failed to fetch user profile',
        RETRIEVE_TOKEN: 'Failed to retrieve token',
        ACCOUNT_CONFLICT: 'account_conflict',
        SYNC_FAILED: 'Sync failed',
        NETWORK: 'Network',
        CUSTOM_CONTENT: 'custom content',
        AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING'
    },
    
    // CSS Class names and Data attributes
    CSS_CLASSES: {
        THREAD_BADGE_ROOT: 'et-thread-badge-root',
        STATS_INJECTED: 'email-track-stats-injected',
        INJECT_ROOT: 'et-inject-root'
    },
    
    DATA_ATTRS: {
        ET_STATUS: 'data-et-status',
        _INJECTED: 'email-track-stats-injected'
    }
} as const;




