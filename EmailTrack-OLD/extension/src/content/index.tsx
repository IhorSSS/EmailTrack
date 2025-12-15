
import { createRoot } from 'react-dom/client';

import StatsDisplay from './components/StatsDisplay';
import DebugPanel from './components/DebugPanel';
import './components/StatsDisplay.css';

console.log('EmailTrack: Content Script Loaded and Active');


const STATS_INJECT_CLASS = 'email-track-stats-injected';
const HOST = 'https://emailtrack.isnode.pp.ua';

// ... (rest of imports/setup preserved by reuse)

// Inject Debug Panel
const debugDiv = document.createElement('div');
document.body.appendChild(debugDiv);
createRoot(debugDiv).render(<DebugPanel />);

const updateDebug = (data: Partial<any>) => {
    window.dispatchEvent(new CustomEvent('EMAIL_TRACK_DEBUG', { detail: data }));
};

// Global tracking state
let globalTrackingEnabled = true;

// Initialize state from storage
chrome.storage.sync.get(['trackingEnabled'], (result) => {
    if (result.trackingEnabled !== undefined) {
        globalTrackingEnabled = !!result.trackingEnabled;
    }
    updateDebug({ trackingEnabled: globalTrackingEnabled, lastAction: 'Loaded Settings' });
});

// Listen for global toggle changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.trackingEnabled) {
        globalTrackingEnabled = !!changes.trackingEnabled.newValue;
        updateDebug({ trackingEnabled: globalTrackingEnabled, lastAction: 'Settings Changed' });
    }
});

// Metadata extraction moved to registerEmail function

// Sanitization observer removed - not needed with external pixel injection

// Track which compose windows already have a pixel injected
const injectedComposeWindows = new WeakSet<Element>();

function injectPixelOnComposeOpen(composeContainer: Element) {
    // Already processed?
    if (injectedComposeWindows.has(composeContainer)) return;

    const body = composeContainer.querySelector('[contenteditable="true"]');
    if (!body) return;

    // Check if tracking is enabled
    if (!globalTrackingEnabled) return;

    const uuid = crypto.randomUUID();
    const timestamp = Date.now();
    const pixelUrl = `${HOST}/track/track.gif?id=${uuid}&t=${timestamp}`;
    const pixelHtml = `<img src="${pixelUrl}" alt="" width="0" height="0" style="width:2px;max-height:0;overflow:hidden" data-track-id="${uuid}">`;

    // Insert at end of body - EARLY, before user finishes composing
    body.insertAdjacentHTML('beforeend', pixelHtml);

    console.log('EmailTrack: Pixel injected on compose open, ID:', uuid);

    // Store the trackId on the container so we can register it on Send
    composeContainer.setAttribute('data-track-pending', uuid);
    injectedComposeWindows.add(composeContainer);

    updateDebug({ pixelInjected: true, lastAction: 'Pixel Pre-Injected' });
}

function handleSendClick(_e: Event, _composeId: string, toolbar: Element) {
    if (!globalTrackingEnabled) return;

    // Find the compose container by going up or finding nearest .aO7
    let composeContainer: Element | null = toolbar.closest('.aO7');

    // Fallback: search upward for data-track-pending
    if (!composeContainer || !composeContainer.hasAttribute('data-track-pending')) {
        let current: Element | null = toolbar;
        for (let i = 0; i < 25; i++) {
            if (!current) break;
            if (current.hasAttribute('data-track-pending')) {
                composeContainer = current;
                break;
            }
            // Also check for .aO7 class
            if (current.classList.contains('aO7') && current.hasAttribute('data-track-pending')) {
                composeContainer = current;
                break;
            }
            current = current.parentElement;
        }
    }

    const trackId = composeContainer?.getAttribute('data-track-pending');

    if (!trackId) {
        // Last resort: find any element with data-track-pending in document
        const pending = document.querySelector('[data-track-pending]');
        if (pending) {
            const fallbackId = pending.getAttribute('data-track-pending');
            if (fallbackId) {
                console.log('EmailTrack: Found pending track via fallback search, ID:', fallbackId);
                updatePixelTimestamp(fallbackId);

                // Also perform cleanup in fallback path
                // pending is the element with data-track-pending, likely the container or body
                // We'll search within its parent/itself
                cleanupOldPixels(fallbackId, pending);

                registerEmail(fallbackId);
                return;
            }
        }
        console.warn('EmailTrack: No pending track ID found anywhere');
        return;
    }

    console.log('EmailTrack: Registering email on Send, ID:', trackId);

    // CRITICAL: Update pixel timestamp to NOW before Gmail serializes
    updatePixelTimestamp(trackId);

    // CRITICAL: Remove all OTHER tracking pixels (from quotes/history) to prevent thread bleed
    if (composeContainer) {
        cleanupOldPixels(trackId, composeContainer);
    }

    registerEmail(trackId);
}

function cleanupOldPixels(currentTrackId: string, composeContainer: Element) {
    console.log('EmailTrack: cleanupOldPixels started for', currentTrackId);

    // Search the ENTIRE compose container, not just contenteditable
    // This catches quoted text, forwarded content, etc.
    const allImages = composeContainer.querySelectorAll('img');
    console.log(`EmailTrack: Found ${allImages.length} images in compose container during cleanup`);

    let removedCount = 0;

    allImages.forEach(img => {
        const src = img.src || '';
        // Check if it's our pixel
        if (src.includes('emailtrack.isnode.pp.ua') || src.includes('/track/track.gif')) {
            // Check if it matches current ID
            const id = img.getAttribute('data-track-id');
            console.log(`EmailTrack: Found pixel. ID: ${id}, Current: ${currentTrackId}, Src: ${src}`);

            // If ID doesn't match, OR if it has no ID (legacy), remove it
            if (id !== currentTrackId) {
                console.log(`EmailTrack: REMOVING OLD PIXEL: ${src}`);
                img.remove();
                removedCount++;
            } else {
                console.log('EmailTrack: Skipping current pixel (match)');
            }
        }
    });

    if (removedCount > 0) {
        console.log(`EmailTrack: Cleaned up ${removedCount} old tracking pixels.`);
        updateDebug({ lastAction: `Cleaned ${removedCount} old pixels` });
    } else {
        console.log('EmailTrack: No old pixels found to clean up.');
    }
}

function updatePixelTimestamp(trackId: string) {
    // Find the pixel by its data-track-id attribute
    const pixel = document.querySelector(`img[data-track-id="${trackId}"]`) as HTMLImageElement;

    if (pixel) {
        const currentSrc = pixel.src;
        // Replace the timestamp parameter with current time
        const newTimestamp = Date.now();
        const newSrc = currentSrc.replace(/&t=\d+/, `&t=${newTimestamp}`);
        pixel.src = newSrc;
        console.log('EmailTrack: Updated pixel timestamp to:', newTimestamp);
    } else {
        console.warn('EmailTrack: Could not find pixel to update timestamp');
    }
}

function registerEmail(trackId: string) {
    // Extract metadata from the compose form
    let subject = 'No Subject';
    let recipient = 'Unknown';

    // Try multiple approaches to find subject
    const subjectInput = document.querySelector('input[name="subjectbox"]') as HTMLInputElement;
    if (subjectInput && subjectInput.value) {
        subject = subjectInput.value;
    }

    // Try to find recipient - ONLY within compose forms
    // First try the "to" input
    const toInput = document.querySelector('input[name="to"]') as HTMLInputElement;
    if (toInput && toInput.value) {
        recipient = toInput.value;
    } else {
        // Try to find the compose form and get chips only from there
        const composeForm = document.querySelector('form.bAs') || document.querySelector('[role="dialog"]');
        if (composeForm) {
            const recipientChips = composeForm.querySelectorAll('[email]');
            const emails = Array.from(recipientChips)
                .map(el => el.getAttribute('email'))
                .filter(e => e && e.includes('@'));
            // Remove duplicates
            const uniqueEmails = [...new Set(emails)];
            if (uniqueEmails.length > 0) {
                recipient = uniqueEmails.join(', ');
            }
        }
    }

    console.log('EmailTrack: Metadata - Subject:', subject, 'Recipient:', recipient);

    try {
        chrome.runtime.sendMessage({
            type: 'REGISTER_EMAIL',
            data: {
                id: trackId,
                subject: subject,
                recipient: recipient
            }
        });
    } catch (ctxErr) {
        console.warn('EmailTrack: Context invalid.');
    }

    updateDebug({ lastAction: 'Email Registered' });
}

// Global Capture Listener for Send Actions
// This replaces the fragile mutation-observer based button attachment.
// We listen for MOUSE DOWN on the body in capture phase to detect clicks on "Send" buttons
// before Gmail processes them.

function isSendButton(target: Element): boolean {
    // 1. Check specific Gmail classes
    if (target.closest('.gU.Up')) return true; // Standard Compose toolbar

    // 2. Check attributes (Tooltip/Label)
    const btn = target.closest('[role="button"]');
    if (!btn) return false;

    const tooltip = btn.getAttribute('data-tooltip') || '';
    const aria = btn.getAttribute('aria-label') || '';

    // Check for "Send" variants (English, Ukrainian, German, etc)
    const keywords = ['Send', 'Senden', 'Надіслати', 'Отправить'];
    const combined = (tooltip + ' ' + aria).toLowerCase();

    // Check if it starts with or contains keywords
    return keywords.some(k => combined.includes(k.toLowerCase()));
}

document.addEventListener('mousedown', (e) => {
    const target = e.target as Element;
    if (isSendButton(target)) {
        console.log('EmailTrack: Send click detected');
        // Find the form/container
        const btn = target.closest('[role="button"]') || target.closest('.gU.Up');
        if (btn) {
            handleSendClick(e, 'global-capture', btn);
        }
    }
}, true); // Capture phase!

// Watch for compose windows appearing
const composeObserver = new MutationObserver(() => {
    // Look for compose containers
    const composeContainers = document.querySelectorAll('.aO7');
    composeContainers.forEach(container => {
        injectPixelOnComposeOpen(container);
    });

    injectStats();
});

composeObserver.observe(document.body, { childList: true, subtree: true });

// Initial scan
document.querySelectorAll('.aO7').forEach(container => {
    injectPixelOnComposeOpen(container);
});
injectStats();

function extractViewMetadata(row: Element) {
    // Subject is usually in h2.hP
    const subjectEl = row.closest('.gs')?.parentElement?.querySelector('h2.hP');
    const subject = subjectEl?.textContent || 'Unknown Subject';

    // Recipient in Sent view is tricky. .gD is usually the sender (Me). 
    // We look for 'to' field: .gD[email] but that might be me.
    // In sent view, .gD is 'me', and the recipient is often in a details span or 'to' list.
    // For now, let's grab the first .gD that is NOT me, or just the subject which is arguably more useful for ID.
    const recipient = 'Recipient (View Mode)';

    return { subject, recipient };
}

function injectStats() {
    // .adn is the container for a single message in conversation view
    const messages = document.querySelectorAll('div.adn');

    messages.forEach((row) => {
        // Find the message body within this container
        const body = row.querySelector('.a3s');
        if (!body) return;

        // Check if we are in "View" mode (not compose)
        const isViewMode = !row.closest('[role="dialog"]');

        // Skip if already injected
        if (row.classList.contains(STATS_INJECT_CLASS)) return;

        const imgs = body.querySelectorAll('img');
        let trackId = null;

        // Scan images but STRICTLY EXCLUDE those inside quoted text.
        // This ensures we only find the pixel that belongs to THIS message body.
        let uniquePixels: { id: string }[] = [];

        for (const img of imgs) {
            // Check if this image is inside a quote
            if (img.closest('.gmail_quote') || img.closest('.im')) {
                continue; // Skip quoted images
            }

            const rawSrc = img.src;
            let decodedSrc = rawSrc;
            try { decodedSrc = decodeURIComponent(rawSrc); } catch { }

            // Match UUID
            const uuidRegex = /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
            const match = rawSrc.match(uuidRegex) || decodedSrc.match(uuidRegex);

            if (match) {
                const id = match[1];
                uniquePixels.push({ id });
            }
        }

        // Pick the first one found in the non-quoted scope
        if (uniquePixels.length > 0) {
            trackId = uniquePixels[0].id;
            console.log(`EmailTrack: Found STRICT pixel: ${trackId}`);
        }

        if (trackId) {
            // Found a pixel!
            // Update Debug Panel with "Found" + Metadata
            if (isViewMode) {
                const metadata = extractViewMetadata(row);
                updateDebug({
                    pixelInjected: true, // It exists!
                    statsVisible: true,
                    lastAction: `Found TrackID: ${trackId}`,
                    subject: metadata.subject,
                    recipient: metadata.recipient
                });
            }

            // 2. Find Injection Point
            // PREFER the Date Element (.gH) inside the row to anchor it to the specific message.
            const dateElement = row.querySelector('.gH');
            const subjectHeader = row.closest('.gs')?.parentElement?.querySelector('h2.hP');

            const anchor = dateElement || subjectHeader; // Changed priority

            if (anchor && anchor.parentElement) {
                const statsContainer = document.createElement('span');
                statsContainer.style.marginLeft = '10px';
                statsContainer.style.display = 'inline-flex';
                statsContainer.style.alignItems = 'center';
                // 'baseline' usually aligns better with text (timestamp), 'middle' can be off-center depending on line-height.
                // Let's try 'middle' but verify standard Gmail icon heights (20px).
                statsContainer.style.verticalAlign = 'middle';

                // Fine-tune to match icons: often they need a tiny visual lift
                statsContainer.style.position = 'relative';
                // statsContainer.style.top = '-1px'; // Removed assumption, sticking to pure flex alignment first.

                statsContainer.onclick = (e) => e.stopPropagation();

                // Insert AFTER the anchor
                if (anchor.nextSibling) {
                    anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
                } else {
                    anchor.parentElement.appendChild(statsContainer);
                }

                row.classList.add(STATS_INJECT_CLASS);
                createRoot(statsContainer).render(<StatsDisplay trackId={trackId} />);
                updateDebug({ lastAction: 'Stats UI Injected (Header) 🚀' });
            } else {
                updateDebug({ lastAction: 'Error: No Header/Date Found' });
            }
        } else if (isViewMode) {
            // If in view mode and NO pixel found after scan
            updateDebug({ lastAction: `Scanned ${imgs.length} imgs: No Pixel` });
        }
    });
}
