import { logger } from '../utils/logger';
import { injectScript, sendConfigToMainWorld } from './modules/infrastructure';
import { setupRegistrationListener } from './modules/registration';
import { injectStats } from './modules/stats';
import './components/StatsDisplay.css';

logger.log('EmailTrack: Content Script UI Loaded');

// 1. Inject Scripts (jQuery, Gmail.js, logic.js)
setTimeout(() => {
    injectScript('jquery.js');
    setTimeout(() => {
        injectScript('gmail.js');
        setTimeout(() => {
            injectScript('logic.js');
        }, 100);
    }, 100);
}, 1000);

// 2. Setup Config Sync (Body Preview Length)
setTimeout(sendConfigToMainWorld, 0);
setTimeout(sendConfigToMainWorld, 500);
setTimeout(sendConfigToMainWorld, 2000);
setInterval(sendConfigToMainWorld, 5000); // Heartbeat

// Watch for Config Changes
try {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (!chrome.runtime?.id) return;
        if (area === 'sync' && changes.bodyPreviewLength) {
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

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    injectStats();
} else {
    window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        injectStats();
    });
}
