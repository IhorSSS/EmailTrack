/**
 * Centralized logging utility for EmailTrack extension
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('Debug message');
 *   logger.warn('Warning message');
 *   logger.error('Error message'); // Always logged
 * 
 * Control via environment:
 *   VITE_DEBUG=true  - Enable all logs
 *   VITE_DEBUG=false - Disable debug logs (errors still show)
 */

const DEBUG = import.meta.env.VITE_DEBUG === 'true' || import.meta.env.DEV;

/**
 * Sanitize data to prevent PII leakage (emails, tokens, etc.)
 */
function sanitize(arg: any): any {
    if (typeof arg === 'string') {
        // Simple email mask: a***b@c.com
        return arg.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, (_match, p1, p2) => {
            if (p1.length <= 2) return `***@${p2}`;
            return `${p1[0]}***${p1[p1.length - 1]}@${p2}`;
        });
    }
    if (arg && typeof arg === 'object') {
        // Sensitive keys to mask/remove
        const sensitiveKeys = ['subject', 'body', 'recipient', 'cc', 'bcc', 'token', 'authorization', 'password', 'user'];
        const sanitized: any = Array.isArray(arg) ? [] : {};

        for (const key in arg) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                sanitized[key] = '[MASKED]';
            } else {
                sanitized[key] = sanitize(arg[key]);
            }
        }
        return sanitized;
    }
    return arg;
}

export const logger = {
    /**
     * Debug log - only shown when VITE_DEBUG=true
     */
    log: (...args: any[]) => {
        if (DEBUG) {
            console.log(...args.map(sanitize));
        }
    },

    /**
     * Warning log - only shown when VITE_DEBUG=true
     */
    warn: (...args: any[]) => {
        if (DEBUG) {
            console.warn(...args.map(sanitize));
        }
    },

    /**
     * Error log - ALWAYS shown (even in production)
     */
    error: (...args: any[]) => {
        console.error(...args.map(sanitize));
    },

    /**
     * Group log - only shown when VITE_DEBUG=true
     */
    group: (label: string) => {
        if (DEBUG) {
            console.group(sanitize(label));
        }
    },

    /**
     * End group log
     */
    groupEnd: () => {
        if (DEBUG) {
            console.groupEnd();
        }
    },

    /**
     * Check if debug mode is enabled
     */
    isDebug: () => DEBUG
};
