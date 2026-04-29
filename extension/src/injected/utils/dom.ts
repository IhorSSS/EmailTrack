import { CONSTANTS } from '../../config/constants';
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
        const composeForm = document.querySelector(CONSTANTS.GMAIL_SELECTORS.COMPOSE_FORM);
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
    } catch {
        return null;
    }
}

// --- DOM INJECTION (Visual / Draft Persistence) ---
export function scanComposeWindows(injectedDrafts: WeakSet<Element>, logger: { log: (...args: unknown[]) => void, error: (...args: unknown[]) => void }) {
    const config = getConfig(); 
    const { HOST, PIXEL_BASE, showTrackingIndicator, trackingEnabled } = config;

    const editables = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.COMPOSE_EDITABLE);
    editables.forEach(editable => {
        const isCompose = editable.closest(CONSTANTS.GMAIL_SELECTORS.COMPOSE_DIALOG) ||
            editable.closest(CONSTANTS.GMAIL_SELECTORS.COMPONENTS.LEGACY_COMPOSE_TD) ||
            editable.closest(CONSTANTS.GMAIL_SELECTORS.COMPONENTS.LEGACY_COMPOSE_M9) ||
            editable.closest(CONSTANTS.GMAIL_SELECTORS.COMPONENTS.LEGACY_COMPOSE_AOI) ||
            editable.closest(CONSTANTS.GMAIL_SELECTORS.COMPONENTS.LEGACY_COMPOSE_A9N);

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

function injectVisualIndicator(editable: Element, enabled: boolean, logger: { log: (...args: unknown[]) => void, error: (...args: unknown[]) => void }) {
    const { COMPONENTS, COMPOSE_DIALOG } = CONSTANTS.GMAIL_SELECTORS;
    const composeWindow = editable.closest(COMPOSE_DIALOG) ||
        editable.closest(COMPONENTS.LEGACY_COMPOSE_TD) ||
        editable.closest(COMPONENTS.LEGACY_COMPOSE_M9) ||
        editable.closest(COMPONENTS.LEGACY_COMPOSE_AOI) ||
        editable.closest(COMPONENTS.LEGACY_COMPOSE_A9N);

    if (!composeWindow) return;

    let indicator = composeWindow.querySelector('.emailtrack-visual-indicator');

    if (!enabled) {
        if (indicator) {
            indicator.remove();
            logger.log('EmailTrack: [Logic] Visual Indicator removed (settings)');
        }
        return;
    }

    if (indicator) {
        // Update existing indicator state
        const configEl = document.getElementById('emailtrack-config');
        const heartbeat = parseInt(configEl?.getAttribute('data-heartbeat') || '0', 10);
        const trackingEnabledAttr = configEl?.getAttribute('data-tracking-enabled') !== 'false';
        const isOrphaned = !configEl || (Date.now() - heartbeat > CONSTANTS.INTERVALS.HEARTBEAT_THRESHOLD_MS);

        const diode = indicator.firstElementChild as HTMLElement;
        if (diode) {
            if (isOrphaned) {
                diode.className = 'emailtrack-diode emailtrack-diode-danger';
                const title = configEl?.getAttribute('data-msg-diode-error') || 'Error';
                indicator.setAttribute('title', title);
            } else if (!trackingEnabledAttr) {
                diode.className = 'emailtrack-diode emailtrack-diode-warning';
                const title = configEl?.getAttribute('data-msg-diode-disabled') || 'Disabled';
                indicator.setAttribute('title', title);
            } else {
                diode.className = 'emailtrack-diode emailtrack-diode-success';
                const title = configEl?.getAttribute('data-msg-diode-active') || 'Active';
                indicator.setAttribute('title', title);
            }
        }
        return;
    }

    // Create minimalist indicator
    indicator = document.createElement('div');
    indicator.className = 'emailtrack-visual-indicator emailtrack-diode-container';

    // Robust selector for Send button across locales (English, Ukrainian, etc.)
    const sendButtons = composeWindow.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.SEND_BUTTONS.join(', '));
    const sendButton = sendButtons.length > 0 ? sendButtons[sendButtons.length - 1] : null;

    if (sendButton) {
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

        const configEl = document.getElementById('emailtrack-config');
        const heartbeat = parseInt(configEl?.getAttribute('data-heartbeat') || '0', 10);
        const trackingEnabledAttr = configEl?.getAttribute('data-tracking-enabled') !== 'false';
        const isOrphaned = !configEl || (Date.now() - heartbeat > CONSTANTS.INTERVALS.HEARTBEAT_THRESHOLD_MS);

        let statusClass = 'emailtrack-diode-success';
        let title = 'EmailTrack: Active & Tracking';

        if (isOrphaned) {
            statusClass = 'emailtrack-diode-danger';
            title = configEl?.getAttribute('data-msg-diode-error') || 'Error: Extension reloaded';
        } else if (!trackingEnabledAttr) {
            statusClass = 'emailtrack-diode-warning';
            title = configEl?.getAttribute('data-msg-diode-disabled') || 'Tracking Disabled';
        } else {
            // Default active
            title = configEl?.getAttribute('data-msg-diode-active') || 'Active';
        }

        const html = `
            <div class="emailtrack-diode ${statusClass}"></div>
        `;

        if (window.__emailTrackPolicy) {
            indicator.innerHTML = window.__emailTrackPolicy.createHTML(html);
        } else {
            indicator.innerHTML = html;
        }
        indicator.setAttribute('title', title);

        const groupAnchors = CONSTANTS.GMAIL_SELECTORS.INDICATOR_ANCHORS;
        const groupContainer = groupAnchors.reduce<Element | null>((acc, selector) => acc || lastInGroup.closest(selector), null);
        const anchor = groupContainer || lastInGroup;
        anchor.insertAdjacentElement('afterend', indicator);
        logger.log('EmailTrack: [Logic] Visual Indicator injected');
    }
}
