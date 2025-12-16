/**
 * EmailTrack - Injected Logic
 * Refactored to TypeScript for better maintainability and type safety.
 */

import { getConfig } from './utils/pixel';
import { scanComposeWindows } from './utils/dom';
import { GmailWrapper } from './utils/gmail';
import { handleSendInterceptor } from './utils/interceptor';

const DEBUG = import.meta.env.DEV;

const logger = {
    log: (...args: any[]) => DEBUG && console.log(...args),
    warn: (...args: any[]) => DEBUG && console.warn(...args),
    error: (...args: any[]) => console.error(...args)
};

// --- Main Logic ---
(function () {
    const CONFIG = getConfig();
    if (!CONFIG.HOST) {
        logger.warn("EmailTrack: [Logic] Missing API Host Config. Retrying initialization...");
        setTimeout(() => location.reload(), 2000);
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
            console.warn('EmailTrack: [Logic] Failed to manage TrustedTypes policy:', e);
        }
    }

    // DOM Observer
    const observer = new MutationObserver(() => {
        const currentConfig = getConfig();
        if (currentConfig.HOST && currentConfig.HOST !== CONFIG.HOST) {
            CONFIG.HOST = currentConfig.HOST;
        }
        scanComposeWindows(injectedDrafts, logger);
    });

    const startObserver = () => {
        observer.observe(document.body, { childList: true, subtree: true });
        scanComposeWindows(injectedDrafts, logger);
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

})();
