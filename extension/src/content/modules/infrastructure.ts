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
        console.warn('EmailTrack: Failed to inject script (context invalidated?)', fileName);
    }
};

// --- Configuration syncing to Main World (DOM-based for Sync Access) ---
export const sendConfigToMainWorld = () => {
    try {
        if (!chrome.runtime?.id) return;
        chrome.storage.sync.get(['bodyPreviewLength'], (res) => {
            if (chrome.runtime.lastError) return; // Ignore errors

            const length = typeof res.bodyPreviewLength === 'number' ? res.bodyPreviewLength : 0;

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
                    // Use console.error to ensure it appears in user logs (bypass filters)
                    logger.log('EmailTrack: [Content] Written config to DOM:', length);
                }
            };

            ensureConfig();
            // Re-check periodically to ensure Gmail didn't wipe it
            setTimeout(ensureConfig, 1000);
        });
    } catch (e) {
        // Ignore context errors
    }
};
