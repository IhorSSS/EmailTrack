import { logger } from '../utils/logger';
import { injectScript, sendConfigToMainWorld } from './modules/infrastructure';
import { setupRegistrationListener } from './modules/registration';
import { injectStats } from './modules/stats';
import { CONSTANTS } from '../config/constants';
import './components/StatsDisplay.css';

logger.log('EmailTrack: Content Script UI Loaded');

// 1. Inject Scripts (jQuery, Gmail.js, logic.js)
// 1. Inject Scripts (jQuery, Gmail.js, logic.js)
// 1. Inject Scripts (jQuery, Gmail.js, logic.js)
const injectCoreScripts = async () => {
    // 0. Ensure Config is there before logic loads
    sendConfigToMainWorld();

    injectScript('jquery.js');
    // Wait for jQuery
    await new Promise(r => setTimeout(r, 100));

    injectScript('gmail.js');
    // Wait for Gmail.js
    await new Promise(r => setTimeout(r, 100));

    // logic.js is now built via Vite and located at root of dist
    // Ensure we try to inject it properly.
    injectScript('logic.js');
};

// Start injection when DOM is ready
const init = () => {
    // Small delay to let Gmail's initial scripts run
    setTimeout(injectCoreScripts, CONSTANTS.CONTENT.INJECTION_DELAY_MS);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 2. Setup Config Sync (Body Preview Length) - Keep a heartbeat for dynamic updates
// Helper to check context
const isValidContext = () => {
    try {
        return !!chrome.runtime?.id;
    } catch {
        return false;
    }
};

// 2. Setup Config Sync (Body Preview Length) - Keep a heartbeat for dynamic updates
setTimeout(() => {
    if (isValidContext()) sendConfigToMainWorld();
}, CONSTANTS.CONTENT.CONFIG_SYNC_DELAY_MS);

const heartbeatId = setInterval(() => {
    if (!isValidContext()) {
        clearInterval(heartbeatId);
        logger.log('[Content] Extension context invalidated. Stopping heartbeat.');
        return;
    }
    sendConfigToMainWorld();
}, CONSTANTS.CONTENT.CONFIG_HEARTBEAT_MS); // Heartbeat

// Watch for Config Changes
try {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (!isValidContext()) return;
        if (area === 'sync' && (changes.bodyPreviewLength || changes.apiUrl)) {
            sendConfigToMainWorld();
        }
    });
} catch (e) {
    logger.warn('[Content] Failed to attach storage listener (context invalidated?)');
}

// 3. Setup Registration Listener (Email Sent -> Backend)
setupRegistrationListener();

// 4. Setup Stats Injection (Message View)
const observer = new MutationObserver(() => {
    if (!isValidContext()) {
        observer.disconnect();
        return;
    }
    injectStats();
});

const startStatsObserver = () => {
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        injectStats();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStatsObserver);
} else {
    startStatsObserver();
}
