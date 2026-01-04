
export interface InjectionResult {
    success: boolean;
    extractedBody: string | null;
}

// --- HELPER: Robust Body Extraction ---
export function extractCleanBody(html: string): string {
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

import { API_CONFIG } from '../../config/api';

// Escape function for regex safety
function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// ...

export function deepModify(obj: any, pixelTag: string): InjectionResult {
    let longestRawBody = { val: "", key: null as string | null, parent: null as any };
    let bestCandidate = { key: null as string | null, val: "", original: "", len: -1, isRich: false, score: -1 };

    const pixelPath = escapeRegExp(API_CONFIG.ENDPOINTS.PIXEL_PATH);
    // Robust Regex: Matches <img> tags that contain EITHER the pixel path OR data-track-id attribute
    // This handles cases where src might be proxied or quotes are different.
    const cleanRegex = new RegExp(`\\<img[^\\>]+(?:src=[\\"'][^\\"']*${pixelPath}|data-track-id)[^\\>]*\\>`, 'gi');

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
