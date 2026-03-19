import { logger } from '../utils/logger';
import { injectScript, sendConfigToMainWorld } from './modules/infrastructure';
import { setupRegistrationListener } from './modules/registration';
import { injectStats } from './modules/stats';
import { injectThreadlistStatus } from './modules/threadlist';
import { CONSTANTS } from '../config/constants';
import './components/StatsDisplay/StatsDisplay.css';
import '../components/common/StatusCheckmark.css';

logger.log('EmailTrack: Content Script UI Loaded');
console.log('[EMAIL_TRACK_DEBUG] Content script index.tsx executed');

// 1. Inject Scripts (jQuery, Gmail.js, logic.js)
const injectCoreScripts = async () => {
    // 0. Ensure Config is there before logic loads
    sendConfigToMainWorld();

    for (const script of CONSTANTS.CORE_SCRIPTS) {
        injectScript(script);
        if (script !== CONSTANTS.CORE_SCRIPTS[CONSTANTS.CORE_SCRIPTS.length - 1]) {
            await new Promise(r => setTimeout(r, CONSTANTS.TIMEOUTS.YIELD));
        }
    }
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
        if (area === 'sync' && (changes[CONSTANTS.STORAGE_KEYS.BODY_PREVIEW_LENGTH] || changes.apiUrl)) {
            sendConfigToMainWorld();
        }
    });
} catch {
    logger.warn('[Content] Failed to attach storage listener (context invalidated?)');
}

// 3. Setup Registration Listener (Email Sent -> Backend)
setupRegistrationListener();

// 4. Setup Stats Injection (Message View)
const observer = new MutationObserver((mutations) => {
    if (!isValidContext()) {
        observer.disconnect();
        return;
    }
    if (mutations.length > 0) {
        console.log(`[EMAIL_TRACK_DEBUG] MutationObserver fired with ${mutations.length} mutations`);
    }
    injectStats();
    injectThreadlistStatus();
});

const startStatsObserver = () => {
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        injectStats();
        injectThreadlistStatus();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStatsObserver);
} else {
    startStatsObserver();
}

// 5. Cleanup on Unload
window.addEventListener('beforeunload', () => {
    if (observer) observer.disconnect();
    if (heartbeatId) clearInterval(heartbeatId);
});

