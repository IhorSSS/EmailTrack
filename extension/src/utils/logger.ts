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

const DEBUG = import.meta.env.VITE_DEBUG === 'true';

export const logger = {
    /**
     * Debug log - only shown when VITE_DEBUG=true
     */
    log: (...args: any[]) => {
        if (DEBUG) {
            console.log(...args);
        }
    },

    /**
     * Warning log - only shown when VITE_DEBUG=true
     */
    warn: (...args: any[]) => {
        if (DEBUG) {
            console.warn(...args);
        }
    },

    /**
     * Error log - ALWAYS shown (even in production)
     */
    error: (...args: any[]) => {
        console.error(...args);
    },

    /**
     * Group log - only shown when VITE_DEBUG=true
     */
    group: (label: string) => {
        if (DEBUG) {
            console.group(label);
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
