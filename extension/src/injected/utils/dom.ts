
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
    const { HOST, PIXEL_BASE } = config;

    const editables = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
    editables.forEach(editable => {
        if (injectedDrafts.has(editable)) return;
        if (!editable.closest('[role="dialog"]') && !editable.closest('td.Bu')) return;

        const existingImg = editable.querySelector(`img[src*="${PIXEL_BASE}"]`) as HTMLImageElement;
        if (existingImg) {
            injectedDrafts.add(editable);
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
    });
}
