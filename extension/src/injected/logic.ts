/**
 * EmailTrack - Injected Logic
 * Refactored to TypeScript for better maintainability and type safety.
 */

import { getConfig } from './utils/pixel';
import { scanComposeWindows } from './utils/dom';
import { GmailWrapper } from './utils/gmail';
import { handleSendInterceptor } from './utils/interceptor';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../config/constants';

let initRetries = 0;
let observer: MutationObserver | null = null;

function initialize() {
    const CONFIG = getConfig();
    if (!CONFIG.HOST) {
        if (initRetries < CONSTANTS.RETRY.ATTEMPTS) {
            initRetries++;
            // Exponential backoff
            const delay = Math.pow(2, initRetries) * 1000;
            logger.warn(`EmailTrack: [Logic] Missing API Host Config. Retrying in ${delay}ms (Attempt ${initRetries}/${CONSTANTS.RETRY.ATTEMPTS})`);
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
                window.__emailTrackPolicy = window.trustedTypes.createPolicy(CONSTANTS.SECURITY.TRUSTED_TYPES_POLICY, {
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
        if (logger.isDebug()) {
            const win = window as unknown as { GmailInstance?: unknown };
            win.GmailInstance = gmail;
        }

        interface GmailInstance {
            observe: {
                before: (event: string, callback: (...args: unknown[]) => boolean | void) => void;
            };
        }

        const gmailInst = gmail as GmailInstance;

        gmailInst.observe.before(CONSTANTS.GMAIL_EVENTS.SEND_MESSAGE, (...args: unknown[]) => {
            const [, , data, xhr] = args as [string, unknown, Record<string, unknown>, { xhrParams?: { body_params?: unknown } }];
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

