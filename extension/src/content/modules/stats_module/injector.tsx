import { createRoot } from 'react-dom/client';
import StatsDisplay from '../../components/StatsDisplay';

import { LocalStorageService } from '../../../services/LocalStorageService';
import { I18nProvider } from '../../../hooks/useTranslation';
import { IdentityDetector } from './detector';
import { CONSTANTS } from '../../../config/constants';
import type { LocalEmailMetadata } from '../../../types';

const STATS_INJECT_CLASS = 'email-track-stats-injected';

// Synchronous cache to prevent Promise/DOM detachment race conditions
let cachedOwnedLocalIds = new Set<string>();
let cachedActiveIdentity: string | null = null;
let isCacheReady = false;

async function syncCache() {
    console.log('[EMAIL_TRACK_DEBUG] syncCache START');
    return new Promise<void>((resolve) => {
        chrome.storage.local.get([CONSTANTS.STORAGE_KEYS.USER_PROFILE, CONSTANTS.STORAGE_KEYS.CURRENT_USER], async (result) => {
            console.log('[EMAIL_TRACK_DEBUG] syncCache: storage.local.get callback');
            if (chrome.runtime?.lastError) {
                console.error('[EMAIL_TRACK_DEBUG] syncCache error:', chrome.runtime.lastError);
                resolve();
                return;
            }
            const userProfile = result[CONSTANTS.STORAGE_KEYS.USER_PROFILE] as { email: string } | undefined;
            const currentUser = result[CONSTANTS.STORAGE_KEYS.CURRENT_USER] as string | undefined;

            const rawLocalEmails: LocalEmailMetadata[] = await LocalStorageService.getEmails();
            cachedOwnedLocalIds = new Set(rawLocalEmails.map(e => e.id));
            
            let extensionIdentity = (userProfile?.email || currentUser)?.toLowerCase();
            if (!extensionIdentity && rawLocalEmails.length > 0) {
                const ownerEmails = rawLocalEmails.map(e => e.ownerEmail).filter((e): e is string => !!e);
                if (ownerEmails.length > 0) {
                    const counts = ownerEmails.reduce((acc: Record<string, number>, email) => {
                        acc[email] = (acc[email] || 0) + 1;
                        return acc;
                    }, {});
                    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                    if (sorted.length > 0) extensionIdentity = sorted[0][0].toLowerCase();
                }
            }
            cachedActiveIdentity = extensionIdentity || IdentityDetector.detectMailboxOwner();
            isCacheReady = true;
            console.log(`[EMAIL_TRACK_DEBUG] syncCache COMPLETE. IDs: ${cachedOwnedLocalIds.size}, Identity: ${cachedActiveIdentity}`);
            resolve();
        });
    });
}

// Keep cache warm
if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.onChanged.addListener((changes) => {
        if (changes[CONSTANTS.STORAGE_KEYS.LOCAL_HISTORY] || changes[CONSTANTS.STORAGE_KEYS.USER_PROFILE]) {
            syncCache();
        }
    });
}

export function handleOptimisticBadge(trackId: string, currentUserEmail: string | null): boolean {
    const messages = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.MESSAGE_ROW);
    if (messages.length === 0) return false;

    for (let i = messages.length - 1; i >= 0; i--) {
        const lastMessage = messages[i] as HTMLElement;

        const hasBadgeElement = lastMessage.querySelector(`.${CONSTANTS.CSS_CLASSES.INJECT_ROOT}`);
        if (lastMessage.classList.contains(STATS_INJECT_CLASS) && hasBadgeElement) continue;

        const body = lastMessage.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_BODY);
        if (!body) continue;

        const imgs = body.querySelectorAll('img');
        let hasPixel = false;
        for (const img of Array.from(imgs)) {
            if (img.closest('.gmail_quote') || img.closest('.im') || img.closest('blockquote')) continue;
            let decodedSrc = img.src;
            try { decodedSrc = decodeURIComponent(img.src); } catch { /* ignore */ }
            if (decodedSrc.includes(trackId)) {
                hasPixel = true;
                break;
            }
        }

        if (!hasPixel) continue;

        lastMessage.setAttribute('data-et-track-id', trackId); // Cache identity for SPA
        return injectBadge(lastMessage, trackId, currentUserEmail);
    }
    return false;
}

export function injectStats() {
    if (!chrome.runtime?.id) return;
    
    if (!isCacheReady) {
        syncCache().then(() => injectStatsRun());
        return;
    }
    injectStatsRun();
}

function injectStatsRun() {
    console.log('[EMAIL_TRACK_DEBUG] injectStatsRun triggered. Cache ready?', isCacheReady, 'Cache size:', cachedOwnedLocalIds.size);
    if (cachedOwnedLocalIds.size === 0) return;

    const messages = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.MESSAGE_ROW);
    if (messages.length > 0) {
        console.log('[EMAIL_TRACK_DEBUG] Found message rows:', messages.length);
    }

    for (let i = 0; i < messages.length; i++) {
        const htmlRow = messages[i] as HTMLElement;
        console.log(`[EMAIL_TRACK_DEBUG] Loop entry: Row ${i} of ${messages.length}`);
        
        const hasBadgeElement = htmlRow.querySelector(`.${CONSTANTS.CSS_CLASSES.INJECT_ROOT}`) as HTMLElement | null;
        const hasClass = htmlRow.classList.contains(STATS_INJECT_CLASS);
        
        // Check if badge is physically present AND actually visible/connected
        // w:0 means it's invisible/collapsed, so we treat it as "not there"
        const isActuallyThere = hasBadgeElement && hasBadgeElement.isConnected && hasBadgeElement.offsetWidth > 5 && hasBadgeElement.offsetHeight > 5;

        if (hasBadgeElement) {
             const rect = hasBadgeElement.getBoundingClientRect();
             if (rect.width <= 5) {
                 console.log(`[EMAIL_TRACK_DEBUG] Row ${i} DETECTED COLLAPSED BADGE: w=${rect.width}, h=${rect.height}. Leaving it for React to fill.`);
                 // We DON'T remove it here anymore to avoid the infinite loop!
                 // Instead, we just wait for the next cycle or CSS fix.
                 if (isActuallyThere) {
                     console.log(`[EMAIL_TRACK_DEBUG] Row ${i} ALREADY INJECTED (but tiny) at x:${Math.round(rect.left)}, y:${Math.round(rect.top)}`);
                     continue;
                 }
             }
        }

        if (hasClass && isActuallyThere) {
            const rect = hasBadgeElement!.getBoundingClientRect();
            console.log(`[EMAIL_TRACK_DEBUG] Row ${i} ALREADY INJECTED & VISIBLE at x:${Math.round(rect.left)}, y:${Math.round(rect.top)}, w:${rect.width}, h:${rect.height}`);
            continue;
        }

        console.log(`[EMAIL_TRACK_DEBUG] Row ${i} starting injection process. hasClass=${hasClass}`);

        let trackId = htmlRow.getAttribute('data-et-track-id') || null;
        if (trackId) console.log(`[EMAIL_TRACK_DEBUG] Row ${i} recovered trackId from dataset: ${trackId}`);

        if (!trackId) {
            const body = htmlRow.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_BODY);
            if (!body) {
                console.log(`[EMAIL_TRACK_DEBUG] Row ${i} lacks body. Skipping.`);
                continue;
            }

            const imgs = body.querySelectorAll('img');
            let foundMatch = false;
            for (const img of Array.from(imgs)) {
                if (img.closest('.gmail_quote') || img.closest('.im') || img.closest('blockquote')) continue;
                
                let decodedSrc = img.src;
                try { decodedSrc = decodeURIComponent(img.src); } catch { /* ignore */ }
                
                const match = decodedSrc.match(CONSTANTS.REGEX.TRACKING_ID);
                if (match) {
                    foundMatch = true;
                    console.log(`[EMAIL_TRACK_DEBUG] Row ${i} regex found UUID: ${match[1]}`);
                    if (cachedOwnedLocalIds.has(match[1])) {
                        trackId = match[1];
                        console.log(`[EMAIL_TRACK_DEBUG] Row ${i} UUID authorized in local cache.`);
                        htmlRow.setAttribute('data-et-track-id', trackId);
                        break;
                    } else {
                        console.log(`[EMAIL_TRACK_DEBUG] Row ${i} UUID not authorized in cache.`);
                    }
                }
            }
            if (!foundMatch && imgs.length > 0) {
                console.log(`[EMAIL_TRACK_DEBUG] Row ${i} checked ${imgs.length} imgs but none matched regex.`);
            }
        }

        if (trackId && cachedOwnedLocalIds.has(trackId)) {
            console.log(`[EMAIL_TRACK_DEBUG] Row ${i} proceeding to injectBadge with ${trackId}`);
            const result = injectBadge(htmlRow, trackId, cachedActiveIdentity);
            console.log(`[EMAIL_TRACK_DEBUG] Row ${i} injectBadge returned: ${result}`);
        }
    }
}

function injectBadge(row: HTMLElement, trackId: string, identity: string | null): boolean {
    // Anchor Priority: Subject > Sender > Date > Fallback
    const subjectElement = row.querySelector('.hP'); // Gmail subject h2
    const dateElement = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_DATE_EL);
    const senderElement = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SENDER_SPAN)?.closest('td');

    const anchor = subjectElement || dateElement || senderElement || row.querySelector('.gs') || row.firstElementChild;
    console.log(`[EMAIL_TRACK_DEBUG] Anchor selected:`, anchor ? (anchor as HTMLElement).className || anchor.tagName : 'NULL');

    if (anchor && anchor.parentElement) {
        const existingContainer = row.querySelector(`.${CONSTANTS.CSS_CLASSES.INJECT_ROOT}`);
        if (existingContainer) {
            console.log(`[EMAIL_TRACK_DEBUG] Removing stale existing container.`);
            existingContainer.remove();
        }

        const statsContainer = document.createElement('span');
        statsContainer.className = CONSTANTS.CSS_CLASSES.INJECT_ROOT;
        statsContainer.onclick = (e) => e.stopPropagation();

        if (anchor.nextSibling) anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
        else anchor.parentElement.appendChild(statsContainer);

        row.classList.add(STATS_INJECT_CLASS);
        console.log(`[EMAIL_TRACK_DEBUG] Rendering React component...`);
        createRoot(statsContainer).render(
            <I18nProvider>
                <StatsDisplay trackId={trackId} senderHint={identity || undefined} />
            </I18nProvider>
        );
        return true;
    }
    console.log(`[EMAIL_TRACK_DEBUG] Injection failed: anchor or parentElement is NULL.`);
    return false;
}
