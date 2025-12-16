/**
 * EmailTrack - Injected Logic
 * Refactored to TypeScript for better maintainability and type safety.
 */

// --- Global Type Definitions ---
declare global {
    interface Window {
        jQuery: any;
        $: any;
        Gmail: any;
        __emailTrackPolicy: any;
        trustedTypes?: {
            createPolicy: (name: string, rules: any) => any;
        };
    }
}

import { API_CONFIG } from '../config/api';

// --- Configuration ---
const getConfig = () => {
    const configEl = document.getElementById('emailtrack-config');
    const domUrl = configEl?.getAttribute('data-api-url');
    // Fallback if DOM not ready yet (should be rare with improved injection)
    // We avoid hardcoding the production URL here to respect the "No Hardcode" rule.
    // However, for development safety, we keep a fallback or throw error if strictly necessary.
    // For now, we will rely on the content script to provide it.
    return {
        HOST: domUrl || API_CONFIG.BASE_URL,
        PIXEL_BASE: API_CONFIG.ENDPOINTS.PIXEL_PATH
    };
};

const DEBUG = import.meta.env.DEV; // Use Vite's env variable

const logger = {
    log: (...args: any[]) => DEBUG && console.log(...args),
    warn: (...args: any[]) => DEBUG && console.warn(...args),
    error: (...args: any[]) => console.error(...args)
};

interface InjectionResult {
    success: boolean;
    extractedBody: string | null;
}

// --- Main Logic ---
(function () {
    const CONFIG = getConfig();
    if (!CONFIG.HOST) {
        logger.warn("EmailTrack: [Logic] Missing API Host Config. Retrying initialization...");
        setTimeout(() => location.reload(), 2000); // Rudimentary retry or handle gracefully
        return;
    }

    logger.log("EmailTrack: [Logic] TS Logic initialized.", CONFIG.HOST);

    let gmail: any = null;
    let _depsRetry = 0;
    const injectedDrafts = new WeakSet<Element>();

    // --- TRUSTED TYPES POLICY ---
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            if (!window.__emailTrackPolicy) {
                window.__emailTrackPolicy = window.trustedTypes.createPolicy('emailTrackPolicy', {
                    createHTML: (string: string) => string
                });
            }
        } catch (e) {
            console.warn('EmailTrack: [Logic] Failed to manage TrustedTypes policy:', e);
        }
    }

    // --- HELPER: Read Config from DOM ---
    function getBodyPreviewLength(): number {
        const configEl = document.getElementById('emailtrack-config');
        if (configEl) {
            const raw = configEl.getAttribute('data-body-preview-length');
            const val = parseInt(raw || '0', 10);
            return isNaN(val) ? 0 : val;
        }
        return 0;
    }

    // --- HELPER: Generate Pixel HTML ---
    function createPixel(trackId: string): string {
        // Sanitize trackId just in case, though it's a UUID
        const safeId = trackId.replace(/[^a-zA-Z0-9-]/g, '');
        const url = `${CONFIG.HOST}${CONFIG.PIXEL_BASE}?id=${safeId}&t=${Date.now()}`;
        // Use a clearer structure
        return `<img src="${url}" alt="" width="1" height="1" style="display:none;" data-track-id="${safeId}" />`;
    }

    // --- DOM INJECTION (Visual / Draft Persistence) ---
    function scanComposeWindows() {
        const editables = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
        editables.forEach(editable => {
            if (injectedDrafts.has(editable)) return;
            if (!editable.closest('[role="dialog"]') && !editable.closest('td.Bu')) return;

            // Updated selector to be more specific if possible, but existing is fine
            const existingImg = editable.querySelector(`img[src*="${CONFIG.PIXEL_BASE}"]`) as HTMLImageElement;
            if (existingImg) {
                injectedDrafts.add(editable);
                if (existingImg.dataset.trackId) {
                    editable.setAttribute('data-et-track-id', existingImg.dataset.trackId);
                }
                return;
            }

            const trackId = crypto.randomUUID();
            // Use createPixel to generate the URL logic
            const safeId = trackId;
            const url = `${CONFIG.HOST}${CONFIG.PIXEL_BASE}?id=${safeId}&t=${Date.now()}`;

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

    // DOM Observer
    const observer = new MutationObserver(() => {
        // Re-read config if it changed dynamically
        const currentConfig = getConfig();
        if (currentConfig.HOST && currentConfig.HOST !== CONFIG.HOST) {
            CONFIG.HOST = currentConfig.HOST;
        }
        scanComposeWindows();
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        scanComposeWindows();
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
            scanComposeWindows();
        });
    }

    // --- HELPER: Robust Body Extraction ---
    function extractCleanBody(html: string): string {
        if (!html) return '';

        let cleanHtml = html;
        const quoteStartRegex = /<(?:div|blockquote)[^>]*?(?:class=["']?(?:gmail_quote|gmail_attr|gmail_quote_container)|id=["']?gmail-quote)[^>]*>/i;

        const match = cleanHtml.match(quoteStartRegex);
        if (match && match.index !== undefined) {
            cleanHtml = cleanHtml.substring(0, match.index);
        }

        const blockquoteMatch = cleanHtml.match(/<blockquote[^>]*>/i);
        if (blockquoteMatch && blockquoteMatch.index !== undefined) {
            cleanHtml = cleanHtml.substring(0, blockquoteMatch.index);
        }

        let text = cleanHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, '');

        text = text.replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');

        return text.split('\n')
            .map(line => line.trim())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // --- HELPER: Deep Modify for XHR Injection ---
    function deepModify(obj: any, pixelTag: string): InjectionResult {
        let longestRawBody = { val: "", key: null as string | null, parent: null as any };
        let bestCandidate = { key: null as string | null, val: "", original: "", len: -1, isRich: false, score: -1 };

        const cleanRegex = /\<img[^\>]+src=[\"'][^\"']*\/track\/track\.gif[^\"']*[\"'][^\>]*\>/gi;

        const traverse = (target: any, depth = 0) => {
            if (!target || typeof target !== 'object') return;

            for (const key in target) {
                let val = target[key];

                if (typeof val === 'string') {
                    // STAGE 1: GLOBAL CLEANUP
                    const matches = val.match(cleanRegex);
                    if (matches && matches.length > 0) {
                        val = val.replace(cleanRegex, '');
                        target[key] = val;
                    }

                    // STAGE 2: CANDIDATE SCORING
                    if (val.length > 0) {
                        const isInternalId = val.startsWith('s:') || val.includes('|#msg-') || val.startsWith('thread-f:');

                        if (!isInternalId && val.length > longestRawBody.val.length && (val.includes('<') || val.length > 20)) {
                            longestRawBody = { val: val, key: key, parent: target };
                        }

                        // Richness Check
                        const isRich = /<(?:div|p|br|table|tr|td|ol|ul|li)[^>]*>/i.test(val);
                        const isValidCandidate = !isInternalId;

                        if (isValidCandidate) {
                            const cleanVal = extractCleanBody(val);
                            if (cleanVal.length > 0) {
                                const matchScore = cleanVal.length + (isRich ? 10000 : 0);
                                if (matchScore > bestCandidate.score) {
                                    bestCandidate = { key: key, val: cleanVal, original: val, len: cleanVal.length, isRich: isRich, score: matchScore };
                                }
                            }
                        }
                    }
                } else if (typeof val === 'object') {
                    if (depth < 10) traverse(val, depth + 1);
                }
            }
        };

        traverse(obj);

        let success = false;
        if (longestRawBody.parent && longestRawBody.key) {
            longestRawBody.parent[longestRawBody.key] += pixelTag;
            success = true;
        }

        return { success, extractedBody: bestCandidate.original || longestRawBody.val };
    }

    function extractSenderEmail(): string | null {
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

    // --- GMAIL.JS INTEGRATION ---
    function startInterceptionSystem() {
        if (typeof window.jQuery === 'undefined' && typeof window.$ !== 'undefined') window.jQuery = window.$;

        if (typeof window.Gmail === 'undefined' || typeof window.jQuery === 'undefined') {
            _depsRetry++;
            if (_depsRetry < 100) setTimeout(startInterceptionSystem, 100);
            return;
        }

        try {
            gmail = new window.Gmail();
            logger.log("EmailTrack: [Logic] Gmail initialized.");
            gmail.observe.before('send_message', interceptSend);
        } catch (e) {
            logger.error('EmailTrack: [Logic] Error:', e);
        }
    }

    function interceptSend(_url: any, _body: any, data: any, xhr: any) {
        const trackId = crypto.randomUUID();
        const pixelTag = createPixel(trackId);

        let injectionResult: InjectionResult = { success: false, extractedBody: null };

        if (xhr && xhr.xhrParams && xhr.xhrParams.body_params) {
            injectionResult = deepModify(xhr.xhrParams.body_params, pixelTag);
        } else if (data) {
            injectionResult = deepModify(data, pixelTag);
        }

        if (injectionResult.success && trackId && data.subject) {
            logger.log("EmailTrack: [Logic] 📧 SEND INTERCEPTED & INJECTED");

            let bodyPreview: string | null = null;
            const currentPreviewLength = getBodyPreviewLength();

            if (currentPreviewLength !== 0 && injectionResult.extractedBody) {
                try {
                    let plainText = extractCleanBody(injectionResult.extractedBody);
                    if (plainText.length === 0) {
                        plainText = injectionResult.extractedBody.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
                    }

                    if (currentPreviewLength === -1) {
                        bodyPreview = plainText;
                    } else {
                        bodyPreview = plainText.length > currentPreviewLength
                            ? plainText.substring(0, currentPreviewLength) + '...'
                            : plainText;
                    }
                } catch (e) { console.error(e); }
            }

            const senderEmail = extractSenderEmail();

            const eventData = {
                id: trackId,
                subject: data.subject || "No Subject",
                recipient: JSON.stringify(data.to || []),
                body: bodyPreview || null,
                sender: senderEmail || 'Unknown'
            };

            window.postMessage({
                type: 'EMAILTRACK_REGISTER',
                detail: eventData
            }, '*');
        }

        return true;
    }

    startInterceptionSystem();

})();
