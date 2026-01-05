
import { getConfig } from './pixel';

export function getBodyPreviewLength(): number {
    const configEl = document.getElementById('emailtrack-config');
    if (configEl) {
        const raw = configEl.getAttribute('data-body-preview-length');
        const val = parseInt(raw || '0', 10);
        return isNaN(val) ? 0 : val;
    }
    return 0;
}

export function extractSenderEmail(): string | null {
    try {
        // Strategy 1: Input name="from"
        const fromField = document.querySelector('input[name="from"]') as HTMLInputElement;
        if (fromField && fromField.value) {
            const match = fromField.value.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            if (match) return match[1];
        }

        // Strategy 2: Span[email]
        const fromSpan = document.querySelector('span[email]');
        if (fromSpan) {
            const email = fromSpan.getAttribute('email');
            if (email) return email;
        }

        // Strategy 3: Dialog data-from
        const composeForm = document.querySelector('[role="dialog"] form, td.Bu form');
        if (composeForm) {
            const dataFrom = composeForm.getAttribute('data-from') || composeForm.querySelector('[data-from]')?.getAttribute('data-from');
            if (dataFrom) {
                const match = dataFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
                if (match) return match[1];
            }
        }

        // Strategy 4: Profile fallback
        const profileBtn = document.querySelector('a[aria-label*="@"][href*="SignOutOptions"]');
        if (profileBtn) {
            const ariaLabel = profileBtn.getAttribute('aria-label');
            if (ariaLabel) {
                const match = ariaLabel.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
                if (match) return match[1];
            }
        }
        return null;
    } catch (e) {
        return null;
    }
}

// --- DOM INJECTION (Visual / Draft Persistence) ---
export function scanComposeWindows(injectedDrafts: WeakSet<Element>, logger: any) {
    const config = getConfig(); // Get fresh config if needed? 
    // Actually scanComposeWindows needs PIXEL_BASE or similar.
    // Let's passed config in or assume it uses the getter. 
    // Best to pass it to avoid cyclic deps or weird state.
    // But getConfig is stateless mostly.

    // We'll import getConfig to handle DOM reading.
    const { HOST, PIXEL_BASE, showTrackingIndicator, trackingEnabled } = config;

    const editables = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
    editables.forEach(editable => {
        const isCompose = editable.closest('[role="dialog"]') ||
            editable.closest('td.Bu') ||
            editable.closest('.M9') ||
            editable.closest('.aoI') ||
            editable.closest('.a9n');

        if (!isCompose) return;

        const existingImg = editable.querySelector(`img[src*="${PIXEL_BASE}"]`) as HTMLImageElement;

        if (injectedDrafts.has(editable)) {
            // Even if already injected, we might need to update the visual indicator
            injectVisualIndicator(editable, showTrackingIndicator && trackingEnabled, logger);
            if (existingImg?.dataset.trackId) {
                editable.setAttribute('data-et-track-id', existingImg.dataset.trackId);
            }
            return;
        }

        if (existingImg) {
            injectedDrafts.add(editable);
            injectVisualIndicator(editable, showTrackingIndicator && trackingEnabled, logger);
            if (existingImg.dataset.trackId) {
                editable.setAttribute('data-et-track-id', existingImg.dataset.trackId);
            }
            return;
        }

        const trackId = crypto.randomUUID();
        const url = `${HOST}${PIXEL_BASE}?id=${trackId}&t=${Date.now()}`;

        const img = document.createElement('img');
        img.src = url;
        img.alt = "";
        img.width = 1;
        img.height = 1;
        img.style.display = "none";
        img.dataset.trackId = trackId;

        editable.appendChild(img);
        injectedDrafts.add(editable);
        editable.setAttribute('data-et-track-id', trackId);
        logger.log(`EmailTrack: [Logic] DOM Injected (ID: ${trackId})`);

        // --- Visual Indicator Injection ---
        injectVisualIndicator(editable, showTrackingIndicator && trackingEnabled, logger);
    });
}

function injectVisualIndicator(editable: Element, enabled: boolean, logger: any) {
    const composeWindow = editable.closest('[role="dialog"]') ||
        editable.closest('td.Bu') ||
        editable.closest('.M9') ||
        editable.closest('.aoI') ||
        editable.closest('.a9n');

    if (!composeWindow) return;

    let indicator = composeWindow.querySelector('.emailtrack-visual-indicator');

    if (!enabled) {
        if (indicator) {
            indicator.remove();
            logger.log('EmailTrack: [Logic] Visual Indicator removed (settings)');
        }
        return;
    }

    if (indicator) return; // Already exists

    // Create minimalist indicator
    indicator = document.createElement('div');
    indicator.className = 'emailtrack-visual-indicator';
    // Style it to be minimalist and fixed at the bottom right of the compose window but NOT in the editable area
    // Find the toolbar or a safe place to attach
    // Search for all potential Send buttons and pick the last one (especially important for inline replies)
    const sendButtons = composeWindow.querySelectorAll('[role="button"][aria-label^="Send"], .T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
    const sendButton = sendButtons.length > 0 ? sendButtons[sendButtons.length - 1] : null;

    if (sendButton) {
        // Find the absolute last element in this group (e.g. Schedule arrow)
        let lastInGroup: Element = sendButton;
        let next = sendButton.nextElementSibling;

        while (next && (
            next.getAttribute('role') === 'button' ||
            next.classList.contains('T-I') ||
            next.classList.contains('G-asl') ||
            next.querySelector('[role="button"]') ||
            next.getAttribute('aria-label')?.includes('Schedule')
        )) {
            lastInGroup = next;
            next = next.nextElementSibling;
        }

        // Style the indicator
        Object.assign((indicator as HTMLElement).style, {
            display: 'inline-flex',
            alignItems: 'center',
            marginLeft: '10px',
            verticalAlign: 'middle',
            cursor: 'help',
            opacity: '0.9',
            padding: '4px',
            flexShrink: '0'
        });

        const html = `
            <div style="width: 10px; height: 10px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 6px rgba(34, 197, 94, 0.4); border: 2px solid white;"></div>
        `;

        if (window.__emailTrackPolicy) {
            indicator.innerHTML = window.__emailTrackPolicy.createHTML(html);
        } else {
            indicator.innerHTML = html;
        }
        indicator.setAttribute('title', 'EmailTrack: Tracking Active');

        // Insert after the group container if possible, otherwise after the last button
        const groupContainer = lastInGroup.closest('.dC') || lastInGroup.closest('.HP') || lastInGroup.closest('[role="group"]');
        const anchor = groupContainer || lastInGroup;

        anchor.insertAdjacentElement('afterend', indicator);
        logger.log('EmailTrack: [Logic] Visual Indicator injected (Outside group)');
    }
}
