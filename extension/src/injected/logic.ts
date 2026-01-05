/**
 * EmailTrack - Injected Logic
 * Refactored to TypeScript for better maintainability and type safety.
 */

import { getConfig } from './utils/pixel';
import { scanComposeWindows } from './utils/dom';
import { GmailWrapper } from './utils/gmail';
import { handleSendInterceptor } from './utils/interceptor';

const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

const logger = {
    log: (...args: any[]) => DEBUG && console.log(...args),
    warn: (...args: any[]) => DEBUG && console.warn(...args),
    error: (...args: any[]) => console.error(...args)
};

// --- Main Logic ---
const MAX_INIT_RETRIES = 5;
let initRetries = 0;
let observer: MutationObserver | null = null;

function initialize() {
    const CONFIG = getConfig();
    if (!CONFIG.HOST) {
        if (initRetries < MAX_INIT_RETRIES) {
            initRetries++;
            const delay = Math.pow(2, initRetries) * 1000;
            logger.warn(`EmailTrack: [Logic] Missing API Host Config. Retrying in ${delay}ms (Attempt ${initRetries}/${MAX_INIT_RETRIES})`);
            setTimeout(initialize, delay);
        } else {
            logger.error("EmailTrack: [Logic] Failed to initialize after maximum retries. Tracking disabled for this session.");
        }
        return;
    }

    logger.log("EmailTrack: [Logic] TS Logic initialized.", CONFIG.HOST);

    const injectedDrafts = new WeakSet<Element>();
    const gmailWrapper = new GmailWrapper(logger);

    // --- TRUSTED TYPES POLICY ---
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            if (!window.__emailTrackPolicy) {
                window.__emailTrackPolicy = window.trustedTypes.createPolicy('emailTrackPolicy', {
                    createHTML: (string: string) => string
                });
            }
        } catch (e) {
            logger.warn('EmailTrack: [Logic] Failed to manage TrustedTypes policy:', e);
        }
    }

    // Cleanup existing observer if any
    if (observer) {
        observer.disconnect();
    }

    // DOM Observer
    observer = new MutationObserver(() => {
        const currentConfig = getConfig();
        if (currentConfig.HOST && currentConfig.HOST !== CONFIG.HOST) {
            CONFIG.HOST = currentConfig.HOST;
        }
        scanComposeWindows(injectedDrafts, logger);
    });

    const startObserver = () => {
        if (observer) {
            observer.observe(document.body, { childList: true, subtree: true });
            scanComposeWindows(injectedDrafts, logger);
        }
    };

    if (document.body) {
        startObserver();
    } else {
        window.addEventListener('DOMContentLoaded', startObserver);
    }

    // --- GMAIL.JS INTEGRATION ---
    gmailWrapper.init((gmail) => {
        // Expose for debugging if needed
        if (DEBUG) window.GmailInstance = gmail;

        gmail.observe.before('send_message', (_url: string, _body: any, data: any, xhr: any) => {
            return handleSendInterceptor(CONFIG, data, xhr, logger);
        });
    });
}

// Start initialization
initialize();

// Handle cleanup (if extension reloads)
window.addEventListener('unload', () => {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
});
