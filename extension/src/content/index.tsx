
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

function getEmailMetadata(form: Element) {
    let subject = 'No Subject';
    let recipient = 'Unknown';

    updateDebug({ lastAction: 'Extracting Metadata...' });

    const subjectInput = form.querySelector('input[name="subjectbox"]') as HTMLInputElement;
    if (subjectInput) {
        subject = subjectInput.value;
    } else {
        const h2 = form.querySelector('h2');
        if (h2) subject = h2.textContent || subject;
    }

    const emailElements = form.querySelectorAll('[email]');
    const foundRecipients = Array.from(emailElements)
        .map(el => el.getAttribute('email'))
        .filter(email => email && email.includes('@') && !email.includes(subject) && !email.includes('Content Script'));

    const uniqueRecipients = [...new Set(foundRecipients)];

    if (uniqueRecipients.length > 0) {
        recipient = uniqueRecipients.join(', ');
    } else {
        const val = (form.querySelector('input[name="to"]') as HTMLInputElement)?.value;
        if (val) recipient = val;
    }

    updateDebug({ subject, recipient });
    return { subject, recipient };
}

function handleSendClick(_e: Event, _composeId: string, toolbar: Element) {
    if (!globalTrackingEnabled) return;

    updateDebug({ lastAction: 'Injecting Pixel...' });

    // New Strategy: Find closest contenteditable relative to the button
    // Traverse up from the button until we find a container that holds a contenteditable logic

    let body: HTMLElement | null = null;
    let current: Element | null = toolbar; // Start at the button/toolbar

    // Traverse up 15 levels max to find a container with the editor
    for (let i = 0; i < 15; i++) {
        if (!current) break;

        // Search down for editor
        const candidate = current.querySelector('[contenteditable="true"]');
        if (candidate) {
            body = candidate as HTMLElement;
            break;
        }

        current = current.parentElement;
    }

    if (body) {
        // CLEANUP: AGGRESSIVE URL DESTRUCTION
        // Gmail's editor might restore removed nodes, so we also NUKE the src attribute.
        // We scan for ANY image that looks like a tracker and kill it.
        const existingImages = body.querySelectorAll('img');
        let removedCount = 0;

        console.log(`EmailTrack: Scanning ${existingImages.length} images for cleanup...`);

        existingImages.forEach(img => {
            const rawSrc = img.src;
            let decodedSrc = rawSrc;
            try { decodedSrc = decodeURIComponent(rawSrc); } catch { }

            const uuidRegex = /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
            const match = rawSrc.match(uuidRegex) || decodedSrc.match(uuidRegex);

            if (rawSrc.includes('track.gif') || match) {
                console.log('EmailTrack: DESTROYING old pixel:', match ? match[1] : 'Unknown ID', rawSrc);
                // Nuke it
                img.src = '';
                img.removeAttribute('src'); // Unlink
                img.style.display = 'none'; // Hide
                img.remove(); // Delete
                removedCount++;
            }
        });

        console.log(`EmailTrack: Cleanup finished. Destroyed ${removedCount} old pixels.`);

        const uuid = crypto.randomUUID();
        console.log('EmailTrack: Generated NEW Track ID:', uuid); // Proof of uniqueness

        const timestamp = Date.now();
        const pixelUrl = `${HOST}/track/track.gif?id=${uuid}&t=${timestamp}`;
        // Use a 1x1 style that is proven to work in Gmail
        // Add data-track-id for easy debugging in DOM
        const pixelHtml = `<img src="${pixelUrl}" alt="" style="display:none;width:0;height:0;" data-track-id="${uuid}" />`;

        try {
            // Method 1: Range Insertion at the end
            body.focus();
            const range = document.createRange();
            range.selectNodeContents(body);
            range.collapse(false); // End of body

            const pixelFragment = range.createContextualFragment(pixelHtml);
            range.insertNode(pixelFragment);

            console.log('EmailTrack: Pixel injected via Range');
        } catch (err) {
            console.error('EmailTrack: Range injection failed, trying append', err);
            // Method 2: Direct Append
            try {
                body.insertAdjacentHTML('beforeend', pixelHtml);
                console.log('EmailTrack: Pixel injected via insertAdjacentHTML');
            } catch (err2) {
                console.error('EmailTrack: All injection methods failed', err2);
            }
        }

        updateDebug({ pixelInjected: true, lastAction: 'Pixel Injected' });

        // Metadata extraction is secondary (might fail if no form), but pixel is critical
        let subject = 'Unknown';
        let recipient = 'Unknown';

        // Try to find form for metadata
        const form = toolbar.closest('form') || current;
        if (form) {
            const meta = getEmailMetadata(form);
            subject = meta.subject;
            recipient = meta.recipient;
        }

        try {
            chrome.runtime.sendMessage({
                type: 'REGISTER_EMAIL',
                data: {
                    id: uuid,
                    subject: subject,
                    recipient: recipient
                }
            });
        } catch (ctxErr) {
            console.warn('EmailTrack: Extension context invalidated (Update detected). Pixel injected, backend will lazy-register. PLEASE RELOAD PAGE.');
        }
    } else {
        console.error('EmailTrack: CRITICAL - Body not found via traversal from', toolbar);
        updateDebug({ lastAction: 'Error: Body not found' });
    }
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
        console.log('EmailTrack: Global capture detected Send click on:', target);
        // Find the form/container
        const btn = target.closest('[role="button"]') || target.closest('.gU.Up');
        if (btn) {
            handleSendClick(e, 'global-capture', btn);
        }
    }
}, true); // Capture phase!

const observer = new MutationObserver((_mutations) => {
    // attachSendListeners(); // Removed
    injectStats();
});

observer.observe(document.body, { childList: true, subtree: true });

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
