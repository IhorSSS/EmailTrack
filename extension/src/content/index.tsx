import { createRoot } from 'react-dom/client';
import StatsDisplay from './components/StatsDisplay';
import './components/StatsDisplay.css';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../config/api';
import { LocalStorageService } from '../services/LocalStorageService';

logger.log('EmailTrack: Content Script UI Loaded');

// --- Script Injection for Main World (Tracking) ---
const injectScript = (fileName: string) => {
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

// Inject dependencies in order
setTimeout(() => {
    injectScript('jquery.js');
    setTimeout(() => {
        injectScript('gmail.js');
        setTimeout(() => {
            injectScript('logic.js');
        }, 100);
    }, 100);
}, 1000);

const STATS_INJECT_CLASS = 'email-track-stats-injected';

// --- Configuration syncing to Main World (DOM-based for Sync Access) ---
const sendConfigToMainWorld = () => {
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

// Initial sync - Aggressive
setTimeout(sendConfigToMainWorld, 0);
setTimeout(sendConfigToMainWorld, 500);
setTimeout(sendConfigToMainWorld, 2000);
setInterval(sendConfigToMainWorld, 5000); // Heartbeat config sync

// Watch for changes
try {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (!chrome.runtime?.id) return;
        if (area === 'sync' && changes.bodyPreviewLength) {
            sendConfigToMainWorld();
        }
    });
} catch (e) { }

// --- Helper to extract user email from Gmail UI ---
function extractUserEmail(): string | null {
    // Try Gmail's user email element
    const emailElement = document.querySelector('.gb_Ha.gb_i, [aria-label*="@"]');
    if (emailElement && emailElement.getAttribute('aria-label')) {
        const label = emailElement.getAttribute('aria-label');
        const match = label?.match(/\(([^)]+)\)/);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// --- Optimistic UI: Listen for Sent Events from logic.js ---
window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'EMAILTRACK_REGISTER') return;

    logger.log('[Content] EMAILTRACK_REGISTER event received:', event.data.detail);
    const { id, subject, recipient, body } = event.data.detail;

    // Strict Validation to prevent "Unknown" ghosts
    if (!id || !subject || subject === 'No Subject') {
        logger.warn('[Content] Ignoring invalid registration event:', event.data.detail);
        return;
    }

    const userEmail = extractUserEmail();
    logger.log('[Content] Extracted user email:', userEmail);

    // Save Current User to Local Storage for Popup usage
    if (userEmail && chrome.runtime?.id) {
        chrome.storage.local.set({ currentUser: userEmail }, () => {
            if (chrome.runtime.lastError) {
                // ignore
            }
        });
    }

    // 1. Save Metadata to Local Storage (Incognito)
    try {
        await LocalStorageService.saveEmail({
            id,
            subject: subject || 'No Subject',
            recipient: recipient || 'Unknown',
            body: body || '',
            user: userEmail || 'Unknown',
            createdAt: new Date().toISOString()
        });
        logger.log('[Content] Saved metadata locally.');
    } catch (e) {
        logger.error('[Content] Failed to save local metadata:', e);
    }

    // 2. Register with Backend (Anonymous / ID Only)
    // Privacy: We do NOT send subject, recipient, body, or user.
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }), // Only ID
    })
        .then((res) => {
            if (!res.ok) {
                logger.error('[Content] Register failed:', res.status, res.statusText);
                return res.text().then((text) => {
                    logger.error('[Content] Error response:', text);
                    throw new Error(`HTTP ${res.status}`);
                });
            }
            return res.json();
        })
        .then((data) => {
            logger.log('[Content] Successfully registered email:', data);
        })
        .catch((err) => {
            logger.error('[Content] Error registering email:', err);
        });

    // 2. Optimistic UI Update (With Retries)
    const attemptInject = (attempt = 1) => {
        const success = handleOptimisticBadge(id);
        if (success) {
            logger.log(`EmailTrack: [UI] Badge Injected on attempt ${attempt}`);
        } else if (attempt < 5) {
            // Retry with backoff (500ms, 1000ms... 2500ms)
            setTimeout(() => attemptInject(attempt + 1), 500 * attempt);
        } else {
            logger.warn('EmailTrack: [UI] Failed to inject optimistic badge after 5 attempts');
        }
    };

    setTimeout(() => attemptInject(1), 500);
});

function handleOptimisticBadge(trackId: string): boolean {
    const messages = document.querySelectorAll('div.adn');
    if (messages.length === 0) return false;

    // Target the last message (most recent)
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.classList.contains(STATS_INJECT_CLASS)) return true;

    // Find Anchor
    const dateElement = lastMessage.querySelector('.gH');
    const subjectHeader = lastMessage.closest('.gs')?.parentElement?.querySelector('h2.hP');
    const anchor = dateElement || subjectHeader;

    if (anchor && anchor.parentElement) {
        logger.log('EmailTrack: [UI] Optimistically injecting badge for', trackId);
        const statsContainer = document.createElement('span');
        statsContainer.style.marginLeft = '10px';
        statsContainer.style.display = 'inline-flex';
        statsContainer.style.alignItems = 'center';
        statsContainer.style.verticalAlign = 'middle';
        statsContainer.style.position = 'relative';

        statsContainer.onclick = (e) => e.stopPropagation();

        if (anchor.nextSibling) {
            anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
        } else {
            anchor.parentElement.appendChild(statsContainer);
        }

        lastMessage.classList.add(STATS_INJECT_CLASS);
        createRoot(statsContainer).render(<StatsDisplay trackId={trackId} />);
        return true;
    }

    return false;
}

function injectStats() {
    // .adn is the container for a single message in conversation view
    const messages = document.querySelectorAll('div.adn');

    messages.forEach((row) => {
        const body = row.querySelector('.a3s');
        if (!body) return;

        // Skip if already injected
        if (row.classList.contains(STATS_INJECT_CLASS)) return;

        const imgs = body.querySelectorAll('img');
        let trackId = null;

        // Scan images but STRICTLY EXCLUDE those inside quoted text.
        let uniquePixels: { id: string }[] = [];

        for (const img of imgs) {
            if (img.closest('.gmail_quote') || img.closest('.im')) {
                continue;
            }

            const rawSrc = img.src;
            let decodedSrc = rawSrc;
            try { decodedSrc = decodeURIComponent(rawSrc); } catch { }

            const uuidRegex = /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
            const match = rawSrc.match(uuidRegex) || decodedSrc.match(uuidRegex);

            if (match) {
                uniquePixels.push({ id: match[1] });
            }
        }

        if (uniquePixels.length > 0) {
            trackId = uniquePixels[0].id;
        }

        if (trackId) {
            // Find Injection Point: .gH (Date/Header) prioritized
            const dateElement = row.querySelector('.gH');
            const subjectHeader = row.closest('.gs')?.parentElement?.querySelector('h2.hP');
            const anchor = dateElement || subjectHeader;

            if (anchor && anchor.parentElement) {
                const statsContainer = document.createElement('span');
                statsContainer.style.marginLeft = '10px';
                statsContainer.style.display = 'inline-flex';
                statsContainer.style.alignItems = 'center';
                statsContainer.style.verticalAlign = 'middle';
                statsContainer.style.position = 'relative';

                statsContainer.onclick = (e) => e.stopPropagation();

                if (anchor.nextSibling) {
                    anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
                } else {
                    anchor.parentElement.appendChild(statsContainer);
                }

                row.classList.add(STATS_INJECT_CLASS);
                createRoot(statsContainer).render(<StatsDisplay trackId={trackId} />);
            }
        }
    });
}


// Watch for DOM changes to inject Stats
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
