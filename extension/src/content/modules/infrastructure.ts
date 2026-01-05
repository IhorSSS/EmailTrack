import { API_CONFIG } from '../../config/api';
import { logger } from '../../utils/logger';

// --- Script Injection for Main World (Tracking) ---
export const injectScript = (fileName: string) => {
    try {
        if (!chrome.runtime?.id) return; // Context invalidated
        const url = chrome.runtime.getURL(fileName);
        const script = document.createElement('script');
        script.src = url;
        script.onload = function () {
            logger.log(`EmailTrack: Injected ${fileName} `);
            (this as HTMLScriptElement).remove();
        };
        (document.head || document.documentElement).appendChild(script);
    } catch (e) {
        // Context invalidated or other runtime error
        logger.warn('EmailTrack: Failed to inject script (context invalidated?)', fileName);
    }
};

// --- Configuration syncing to Main World (DOM-based for Sync Access) ---
export const sendConfigToMainWorld = () => {
    try {
        if (!chrome.runtime?.id) return;
        chrome.storage.sync.get(['bodyPreviewLength', 'showTrackingIndicator', 'trackingEnabled'], (res) => {
            if (chrome.runtime?.lastError) return; // Ignore errors

            const length = typeof res.bodyPreviewLength === 'number' ? res.bodyPreviewLength : 0;
            const showIndicator = res.showTrackingIndicator !== false; // Default true
            const trackingEnabled = res.trackingEnabled !== false; // Default true
            const apiUrl = API_CONFIG.BASE_URL;

            const ensureConfig = () => {
                let configEl = document.getElementById('emailtrack-config');
                if (!configEl) {
                    configEl = document.createElement('div');
                    configEl.id = 'emailtrack-config';
                    configEl.style.display = 'none';
                    (document.head || document.documentElement).appendChild(configEl);
                }

                if (configEl.getAttribute('data-body-preview-length') !== length.toString()) {
                    configEl.setAttribute('data-body-preview-length', length.toString());
                }

                if (configEl.getAttribute('data-show-tracking-indicator') !== showIndicator.toString()) {
                    configEl.setAttribute('data-show-tracking-indicator', showIndicator.toString());
                }

                if (configEl.getAttribute('data-tracking-enabled') !== trackingEnabled.toString()) {
                    configEl.setAttribute('data-tracking-enabled', trackingEnabled.toString());
                }

                if (configEl.getAttribute('data-api-url') !== apiUrl) {
                    configEl.setAttribute('data-api-url', apiUrl);
                    logger.log('EmailTrack: [Content] synced config. API:', apiUrl);
                }

                // Heartbeat to detect orphaned state in main world
                configEl.setAttribute('data-heartbeat', Date.now().toString());
            };

            ensureConfig();
        });
    } catch (e) {
        // Ignore context errors
    }
};
