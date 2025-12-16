import { logger } from '../utils/logger';
import { injectScript, sendConfigToMainWorld } from './modules/infrastructure';
import { setupRegistrationListener } from './modules/registration';
import { injectStats } from './modules/stats';
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
    setTimeout(injectCoreScripts, 200);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 2. Setup Config Sync (Body Preview Length) - Keep a heartbeat for dynamic updates
setTimeout(sendConfigToMainWorld, 2000);
setInterval(sendConfigToMainWorld, 5000); // Heartbeat

// Watch for Config Changes
try {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (!chrome.runtime?.id) return;
        if (area === 'sync' && (changes.bodyPreviewLength || changes.apiUrl)) {
            sendConfigToMainWorld();
        }
    });
} catch (e) { }

// 3. Setup Registration Listener (Email Sent -> Backend)
setupRegistrationListener();

// 4. Setup Stats Injection (Message View)
const observer = new MutationObserver(() => {
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
