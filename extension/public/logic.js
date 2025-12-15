/**
 * Configuration for tracking logic
 * IMPORTANT: Keep in sync with src/config/api.ts
 */
const CONFIG = {
    HOST: 'https://emailtrack.isnode.pp.ua',
    PIXEL_BASE: '/track/track.gif'
};

// Centralized logger (manually toggle DEBUG for production)
const DEBUG = true; // Set to false to disable all logs
const logger = {
    log: (...args) => DEBUG && console.log(...args),
    warn: (...args) => DEBUG && console.warn(...args),
    error: (...args) => console.error(...args) // Always log errors
};

(function () {
    logger.log("EmailTrack: [Logic] Logic.js initialized (Hybrid Mode).");

    let gmail = null;
    let _depsRetry = 0;
    const injectedDrafts = new WeakSet();

    // --- TRUSTED TYPES POLICY ---
    let policy = null;
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            if (!window.__emailTrackPolicy) {
                window.__emailTrackPolicy = window.trustedTypes.createPolicy('emailTrackPolicy', {
                    createHTML: (string) => string
                });
            }
            policy = window.__emailTrackPolicy;
        } catch (e) {
            console.warn('EmailTrack: [Logic] Failed to manage TrustedTypes policy:', e);
        }
    }

    // --- HELPER: Read Config from DOM (Synchronous & Reliable) ---
    function getBodyPreviewLength() {
        const configEl = document.getElementById('emailtrack-config');
        if (configEl) {
            const raw = configEl.getAttribute('data-body-preview-length');
            const val = parseInt(raw, 10);
            logger.log(`EmailTrack: [Logic] Read DOM Config: El found, Raw='${raw}', Parsed=${val}`);
            return isNaN(val) ? 0 : val;
        }
        console.error('EmailTrack: [Logic] [CRITICAL] Read DOM Config: Element #emailtrack-config NOT FOUND!');
        return 0; // Default to 0 (Privacy Safe) if not yet synced
    }

    // --- HELPER: Generate Pixel HTML ---
    function createPixel(trackId) {
        // Use a standard, hardcoded pixel tag to ensure consistency
        const url = `${CONFIG.HOST}${CONFIG.PIXEL_BASE}?id=${trackId}&t=${Date.now()}`;
        return `<img src="${url}" alt="" width="1" height="1" style="display:none;" data-track-id="${trackId}" />`;
    }

    // --- DOM INJECTION (Visual / Draft Persistence) ---
    function scanComposeWindows() {
        // ... (unchanged) ...
        const editables = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
        editables.forEach(editable => {
            // ... existing logic ...
            if (injectedDrafts.has(editable)) return;
            if (!editable.closest('[role="dialog"]') && !editable.closest('td.Bu')) return;

            const existingImg = editable.querySelector(`img[src*="${CONFIG.PIXEL_BASE}"]`);
            if (existingImg) {
                injectedDrafts.add(editable);
                if (existingImg.dataset.trackId) {
                    editable.dataset.etTrackId = existingImg.dataset.trackId;
                }
                return;
            }

            const trackId = crypto.randomUUID();
            const url = `${CONFIG.HOST}${CONFIG.PIXEL_BASE}?id=${trackId}&t=${Date.now()}`;

            const img = document.createElement('img');
            img.src = url;
            img.alt = "";
            img.width = 1;
            img.height = 1;
            img.style.display = "none";
            img.dataset.trackId = trackId;

            editable.appendChild(img);
            injectedDrafts.add(editable);
            editable.dataset.etTrackId = trackId;
            logger.log(`EmailTrack: [Logic] DOM Injected (ID: ${trackId})`);
        });
    }

    // DOM Observer
    const observer = new MutationObserver(() => scanComposeWindows());
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        scanComposeWindows();
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
            scanComposeWindows();
        });
    }

    // --- XHR INJECTION: Clean & Inject ---
    // ...
    function deepModify(obj, pixelTag) {
        let longestRawBody = { val: "", key: null, parent: null };
        let bestCandidate = { key: null, val: "", original: "", len: -1, isRich: false, score: -1 };
        let pixelsCleanedCount = 0;

        // Enhanced regex to catch all tracking pixel variations
        const cleanRegex = /\<img[^\>]+src=[\"'][^\"']*\/track\/track\.gif[^\"']*[\"'][^\>]*\>/gi;

        const traverse = (target, depth = 0) => {
            if (!target || typeof target !== 'object') return;

            for (const key in target) {
                let val = target[key];

                if (typeof val === 'string') {
                    // STAGE 1: GLOBAL CLEANUP
                    const matches = val.match(cleanRegex);
                    if (matches && matches.length > 0) {
                        pixelsCleanedCount += matches.length;
                        val = val.replace(cleanRegex, '');
                        target[key] = val;
                    }

                    // STAGE 2: CANDIDATE SCORING
                    if (val.length > 0) {
                        // A. Injection Candidate (Longest RAW HTML)
                        // Must look like HTML or be reasonably long.
                        // Filter out OBVIOUS garbage (Gmail internal IDs starting with s: or containing |#msg-)
                        const isInternalId = val.startsWith('s:') || val.includes('|#msg-') || val.startsWith('thread-f:');

                        if (!isInternalId && val.length > longestRawBody.val.length && (val.includes('<') || val.length > 20)) {
                            longestRawBody = { val: val, key: key, parent: target };
                        }

                        // B. Extraction Candidate (Best Human Text)
                        // SIMPLIFIED LOGIC:
                        // 1. Must NOT be an internal ID.
                        // 2. Score = Length + Bonus for Richness (HTML structure).
                        //    Gmail Composer almost always wraps content in <div>, <p>, or <br> (Rich Text).
                        //    Metadata (Name, Subject) is usually Plain Text.
                        //    Therefore, Rich Text gets a massive score bonus to win even if short ("Test").

                        // Check for Rich structure
                        const isRich = /<(?:div|p|br|table|tr|td|ol|ul|li)[^>]*>/i.test(val);

                        // Valid if: It's not a known system ID string.
                        // We allow single words, numbers, unicode, etc. as long as they aren't s: IDs.
                        const isValidCandidate = !isInternalId;

                        if (isValidCandidate) {
                            const cleanVal = extractCleanBody(val);

                            // Only compete if we actually found text (or if meaningful empty body?)
                            // Allow len >= 0 so we can catch empty-ish but rich bodies over nothing.
                            // But usually we want text. Let's say len > 0.
                            if (cleanVal.length > 0) {
                                // Prefer Rich text over Plain text significantly, then length
                                const matchScore = cleanVal.length + (isRich ? 10000 : 0);
                                const currentScore = bestCandidate.score;

                                if (matchScore > currentScore) {
                                    bestCandidate = { key: key, val: cleanVal, original: val, len: cleanVal.length, isRich: isRich, score: matchScore };
                                }

                                // Logging for diagnosis (only relevant candidates)
                                if (val.length > 20 || cleanVal.length > 0) {
                                    // logger.log(`EmailTrack: [Logic] Cand '${key}': CleanLen=${cleanVal.length}, Rich=${isRich}, Score=${matchScore}`);
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

        const selectedInjectionKey = longestRawBody.key;
        const selectedExtractionSource = bestCandidate.original || longestRawBody.val;

        if (selectedInjectionKey) {
            logger.log(`EmailTrack: [Logic] Win -> Inject: '${selectedInjectionKey}' / Extract: '${bestCandidate.key || selectedInjectionKey}' (Len: ${bestCandidate.len}, Rich: ${bestCandidate.isRich})`);
        } else {
            logger.warn("EmailTrack: [Logic] No suitable body found.");
        }

        // STAGE 3: INJECTION
        let success = false;
        if (longestRawBody.parent && longestRawBody.key) {
            longestRawBody.parent[longestRawBody.key] += pixelTag;
            success = true;
        }

        return { success: success, extractedBody: selectedExtractionSource };
    }

    // --- HELPER: Robust Body Extraction (Pure JS, no DOMParser dependency) ---
    function extractCleanBody(html) {
        if (!html) return '';

        // 1. Truncate at common quote starters (History)
        // Matches: <div class="gmail_quote... or <blockquote... or <div class="gmail_attr... or id="gmail-quote"
        // We use a regex to find the *first* occurrence of these container starts.
        const quoteStartRegex = /<(?:div|blockquote)[^>]*?(?:class=["']?(?:gmail_quote|gmail_attr|gmail_quote_container)|id=["']?gmail-quote)[^>]*>/i;

        let cleanHtml = html;
        const match = cleanHtml.match(quoteStartRegex);

        if (match && match.index !== undefined) {
            // Cut off everything starting from the quote container
            cleanHtml = cleanHtml.substring(0, match.index);
        }

        // 2. Strip standard blockquotes if not caught by class (Generic fallback)
        const blockquoteMatch = cleanHtml.match(/<blockquote[^>]*>/i);
        if (blockquoteMatch && blockquoteMatch.index !== undefined) {
            cleanHtml = cleanHtml.substring(0, blockquoteMatch.index);
        }

        // 3. Preserve Newlines: Replace <br>, </div>, </p> with \n
        let text = cleanHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, ''); // Strip remaining tags

        // 4. Decode Common Entities
        text = text.replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');

        // 5. Cleanup excessive whitespace
        // Split by newline, trim each line (removes spaces on blank lines), join back
        // Then collapse 3+ newlines to just 2 (one blank line max)
        return text.split('\n')
            .map(line => line.trim())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // --- GMAIL.JS INTEGRATION ---
    function startInterceptionSystem() {
        if (typeof window.jQuery === 'undefined' && typeof window.$ !== 'undefined') window.jQuery = window.$;

        if (typeof Gmail === 'undefined' || typeof window.jQuery === 'undefined') {
            _depsRetry++;
            if (_depsRetry < 100) setTimeout(startInterceptionSystem, 100);
            return;
        }

        try {
            gmail = new Gmail();
            logger.log("EmailTrack: [Logic] Gmail initialized.");
            gmail.observe.before('send_message', interceptSend);
        } catch (e) {
            logger.error('EmailTrack: [Logic] Error:', e);
        }
    }

    function interceptSend(url, body, data, xhr) {
        // ALWAYS Generate a Fresh ID
        const trackId = crypto.randomUUID();
        const pixelTag = createPixel(trackId);

        let injectionResult = { success: false, extractedBody: null };

        // Robust Injection into XHR Params
        if (xhr && xhr.xhrParams && xhr.xhrParams.body_params) {
            injectionResult = deepModify(xhr.xhrParams.body_params, pixelTag);
        } else if (data) {
            // Fallback
            injectionResult = deepModify(data, pixelTag);
        }

        // CRITICAL CHECK: Only register if injection actually succeeded!
        // This prevents duplicate/phantom events from autosaves or empty requests.
        // Also ensure we have a subject.
        if (injectionResult.success && trackId && data.subject) {
            logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            logger.log("EmailTrack: [Logic] 📧 SEND INTERCEPTED & INJECTED");
            logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

            // Extract body text based on user preference (LIVE READ from DOM)
            // Extract body text based on user preference
            let bodyPreview = null;
            const currentPreviewLength = getBodyPreviewLength();

            logger.log(`EmailTrack: [Logic] Body Preview Mode: ${currentPreviewLength}`);

            if (currentPreviewLength !== 0) {
                try {
                    const bodyField = injectionResult.extractedBody || data.body || data.msgbody || data.ct || '';
                    if (bodyField) {
                        // DEBUG: Inspect what we found (CRITICAL for debugging)
                        logger.log(`EmailTrack: [Logic] Raw Body Field (first 200 chars): ${bodyField.substring(0, 200)}...`);

                        // Use the robust pure-JS extractor
                        let plainText = extractCleanBody(bodyField);

                        logger.log(`EmailTrack: [Logic] Stripped Text (Cleaned): "${plainText.substring(0, 50)}..." (Length: ${plainText.length})`);

                        if (plainText.length === 0) {
                            logger.warn("EmailTrack: [Logic] Smart clean returned empty. Falling back to basic tag strip.");
                            plainText = bodyField.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
                        }

                        if (currentPreviewLength === -1) {
                            bodyPreview = plainText;
                        } else {
                            if (plainText.length > currentPreviewLength) {
                                bodyPreview = plainText.substring(0, currentPreviewLength) + '...';
                            } else {
                                bodyPreview = plainText;
                            }
                        }
                    } else {
                        logger.warn('EmailTrack: [Logic] extractedBody was empty/falsy.');
                    }
                } catch (e) {
                    console.error('EmailTrack: [Logic] [CRITICAL] Could not extract body preview:', e);
                }
            } else {
                logger.log('EmailTrack: [Logic] Body preview disabled by user setting.');
            }

            const eventData = {
                id: trackId,
                subject: data.subject || "No Subject",
                recipient: JSON.stringify(data.to || []),
                body: bodyPreview || null
            };

            window.postMessage({
                type: 'EMAILTRACK_REGISTER',
                detail: eventData
            }, '*');

            logger.log("EmailTrack: [Logic] 📤 Event dispatched via postMessage:", eventData);
        } else {
            // Log why we didn't dispatch
            if (!injectionResult.success) {
                logger.warn("EmailTrack: [Logic] Skipped registration - Injection failed (no body found).");
            } else if (!data.subject) {
                logger.warn("EmailTrack: [Logic] Skipped registration - No subject (likely autosave).");
            }
        }

        return true;
    }

    startInterceptionSystem();

})();
