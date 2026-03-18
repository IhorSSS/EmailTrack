/**
 * EmailTrack - Backend Constants
 * Centralized constants for tracking logic, bot detection, and responses.
 */

export const TRACKING_CONSTANTS = {
    // 1x1 Transparent GIF
    PIXEL_GIF: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
    
    // Response Headers
    HEADERS: {
        GIF: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
        PNG: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        }
    },

    // Bot Detection Signatures (User-Agents)
    BOT_SIGNATURES: [
        'GoogleImageProxy',
        'Microsoft Preview',
        'Outlook-iOS',
        'Outlook-Android',
        'Office365-Crawler'
    ],

    // Tracking Windows (ms)
    WINDOWS: {
        DEBOUNCE: 2000, // 2 seconds to ignore double-renders by some clients
        CLEANUP_STALE_MS: 1000 * 60 * 60 * 24 * 30, // 30 days
    },

    // Metadata Placeholders (Hardcode prevention)
    PLACEHOLDERS: {
        SUBJECT_UNAVAILABLE: '(Subject Unavailable - Registration Failed)',
        RECIPIENT_UNKNOWN: 'Unknown'
    }
};
