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

    // --- HELPER: Generate Pixel HTML ---
    function createPixel(trackId) {
        // Use a standard, hardcoded pixel tag to ensure consistency
        const url = `${CONFIG.HOST}${CONFIG.PIXEL_BASE}?id=${trackId}&t=${Date.now()}`;
        return `<img src="${url}" alt="" width="1" height="1" style="display:none;" data-track-id="${trackId}" />`;
    }

    // --- DOM INJECTION (Visual / Draft Persistence) ---
    function scanComposeWindows() {
        const editables = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
        editables.forEach(editable => {
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
    // VARIANT 2: Preserve Gmail quotes (threading behavior), but clean ALL old pixels
    // 1. Clean ALL old pixels recursively (from quotes too)
    // 2. Inject ONE new pixel (at end of top-level body content)
    function deepModify(obj, pixelTag) {
        let longestBodyVal = "";
        let longestBodyKey = null;
        let longestBodyParent = null;
        let pixelsCleanedCount = 0;

        // Enhanced regex to catch all tracking pixel variations
        const cleanRegex = /\<img[^\>]+src=[\"'][^\"']*\/track\/track\.gif[^\"']*[\"'][^\>]*\>/gi;

        // Recursive Traversal
        const traverse = (target, depth = 0) => {
            if (!target || typeof target !== 'object') return;

            for (const key in target) {
                let val = target[key];

                if (typeof val === 'string') {
                    // STAGE 1: GLOBAL CLEANUP
                    // Remove ALL old pixels, including those in nested blockquotes
                    const matches = val.match(cleanRegex);
                    if (matches && matches.length > 0) {
                        pixelsCleanedCount += matches.length;
                        logger.log(`EmailTrack: [Logic] [Depth ${depth}] Cleaning ${matches.length} old pixel(s) from key [${key}] (length: ${val.length})`);
                        val = val.replace(cleanRegex, '');
                        target[key] = val; // Apply cleanup
                    }

                    // CANDIDATE DETECTION for injection
                    // Find the longest HTML body (this will be the top-level content including quotes)
                    if (val.includes('<div') || val.includes('<br')) {
                        if (val.length > longestBodyVal.length) {
                            longestBodyVal = val;
                            longestBodyKey = key;
                            longestBodyParent = target;
                        }
                    }
                }
                else if (typeof val === 'object') {
                    traverse(val, depth + 1);
                }
            }
        };

        // Run Traversal
        logger.log(`EmailTrack: [Logic] Starting deep cleanup & injection...`);
        traverse(obj);
        logger.log(`EmailTrack: [Logic] Cleanup complete: ${pixelsCleanedCount} old pixel(s) removed`);

        // STAGE 2: INJECTION
        // Add ONE new pixel at the end of the main body
        if (longestBodyParent && longestBodyKey) {
            logger.log(`EmailTrack: [Logic] Injecting NEW pixel into key [${longestBodyKey}] (Length: ${longestBodyVal.length})`);
            longestBodyParent[longestBodyKey] += pixelTag;
            logger.log(`EmailTrack: [Logic] ✓ Injection successful - 1 new pixel added`);
            return true;
        } else {
            logger.warn(`EmailTrack: [Logic] ✗ No suitable injection target found`);
        }

        return false;
    }

    // --- INTERCEPTION SYSTEM ---
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
        logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        logger.log("EmailTrack: [Logic] 📧 SEND INTERCEPTED");
        logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // ALWAYS Generate a Fresh ID for the outgoing email
        // This ensures thread hygiene and accurate tracking for THIS specific send.
        const trackId = crypto.randomUUID();
        const pixelTag = createPixel(trackId);

        let injected = false;

        // Robust Injection into XHR Params
        if (xhr && xhr.xhrParams && xhr.xhrParams.body_params) {
            logger.log("EmailTrack: [Logic] Target: xhr.xhrParams.body_params");
            injected = deepModify(xhr.xhrParams.body_params, pixelTag);

            if (injected) {
                logger.log("✓ EmailTrack: [Logic] Cleanup & Injection SUCCESSFUL (XHR)");
            } else {
                logger.warn("✗ EmailTrack: [Logic] Injection FAILED - No suitable body found");
            }
        } else if (data) {
            // Fallback: Try modifying 'data' if XHR structure is unexpected
            logger.warn("EmailTrack: [Logic] XHR params unavailable, trying legacy 'data' injection");
            injected = deepModify(data, pixelTag);
            if (injected) {
                logger.log("✓ EmailTrack: [Logic] Cleanup & Injection via fallback");
            }
        } else {
            logger.error("✗ EmailTrack: [Logic] No valid injection target found!");
        }

        // Notify Extension / UI
        if (trackId) {
            const eventData = {
                id: trackId,
                subject: data.subject || "No Subject",
                recipient: JSON.stringify(data.to || [])
            };

            window.dispatchEvent(new CustomEvent('EMAILTRACK_REGISTER', {
                detail: eventData
            }));

            logger.log("EmailTrack: [Logic] 📤 Event dispatched:", eventData);
        }

        logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        return true;
    }

    startInterceptionSystem();

})();
