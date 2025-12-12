
import { createRoot } from 'react-dom/client';

import StatsDisplay from './components/StatsDisplay';
import DebugPanel from './components/DebugPanel';
import './components/StatsDisplay.css';

console.log('EmailTrack: Content Script Loaded and Active');

const INJECT_CLASS = 'email-track-injected';
const STATS_INJECT_CLASS = 'email-track-stats-injected';
const HOST = 'https://emailtrack.isnode.pp.ua';

// ... (rest of imports/setup preserved by context, focusing on change)

// ...



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

    const form = toolbar.closest('form') || toolbar.closest('div[role="dialog"]');
    if (!form) return;

    // Locale-agnostic body selector: look for contenteditable div that is NOT the subject line
    const body = form.querySelector('div[contenteditable="true"][role="textbox"][aria-multiline="true"]') ||
        form.querySelector('.Am.Al.editable');

    if (body) {
        const uuid = crypto.randomUUID();
        // Use proven format that bypasses Gmail blocking (based on email-signature-image.com)
        // Key techniques: width=0/height=0, overflow:hidden, .gif extension, query params
        const timestamp = Date.now();
        const pixel = `<img src="${HOST}/track/track.gif?id=${uuid}&t=${timestamp}" alt="" width="0" height="0" style="width:2px;max-height:0;overflow:hidden" />`;

        (body as HTMLElement).focus();

        // Append to end of body
        const range = document.createRange();
        range.selectNodeContents(body);
        range.collapse(false); // Go to end

        const pixelNode = range.createContextualFragment(pixel);
        range.insertNode(pixelNode);

        updateDebug({ pixelInjected: true, lastAction: 'Pixel Injected' });

        const metadata = getEmailMetadata(form);

        chrome.runtime.sendMessage({
            type: 'REGISTER_EMAIL',
            data: {
                id: uuid,
                subject: metadata.subject,
                recipient: metadata.recipient
            }
        });
    } else {
        updateDebug({ lastAction: 'Error: Body not found' });
    }
}

// Re-implement button injection essentially just to attach the event listener
// But simpler, without the UI button
function attachSendListeners() {
    const sendButtonContainers = document.querySelectorAll('.gU.Up');

    sendButtonContainers.forEach((container) => {
        const toolbar = container.closest('tr');
        if (!toolbar) return;

        if (toolbar.classList.contains(INJECT_CLASS)) return;

        const composeId = Math.random().toString(36).substring(7);
        toolbar.setAttribute('data-compose-id', composeId);
        toolbar.classList.add(INJECT_CLASS);

        // Find the actual button to attach listener
        const btn = container.querySelector('[role="button"]');
        if (btn) {
            // Use Mousedown to capture event before Gmail destroys the form
            btn.addEventListener('mousedown', (e) => handleSendClick(e, composeId, toolbar));
        }
    });
}

const observer = new MutationObserver((_mutations) => {
    attachSendListeners();
    injectStats();
});

observer.observe(document.body, { childList: true, subtree: true });

attachSendListeners();
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
    // .gs is the grid system, .a3s is message body.
    const messages = document.querySelectorAll('.gs');

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

        // ... (Regex matching logic same as before, simplified for brevity in replace if needed, but keeping full)
        // Scan images in reverse order to find the LATEST injected pixel (usually at the bottom)
        // This avoids picking up old pixels from quoted text in replies.
        const reversedImgs = Array.from(imgs).reverse();

        for (const img of reversedImgs) {
            const rawSrc = img.src;
            let decodedSrc = rawSrc;
            try { decodedSrc = decodeURIComponent(rawSrc); } catch { }

            const uuidRegex = /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
            const match = rawSrc.match(uuidRegex) || decodedSrc.match(uuidRegex);

            if (match) {
                trackId = match[1];
                console.log('EmailTrack: Found ID (Latest):', trackId);
                break;
            }
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
                statsContainer.style.marginLeft = '12px';
                statsContainer.style.display = 'inline-flex'; // flexible
                statsContainer.style.verticalAlign = 'middle';
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
