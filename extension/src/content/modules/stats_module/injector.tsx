import { createRoot } from 'react-dom/client';
import StatsDisplay from '../../components/StatsDisplay';
import { LocalStorageService } from '../../../services/LocalStorageService';
import { I18nProvider } from '../../../hooks/useTranslation';
import { IdentityDetector } from './detector';
import { CONSTANTS } from '../../../config/constants';
import type { LocalEmailMetadata } from '../../../types';


/**
 * Optimistically injects a badge for a just-sent email.
 */
export function handleOptimisticBadge(trackId: string, currentUserEmail: string | null): boolean {
    const messages = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.MESSAGE_ROW);
    if (messages.length === 0) return false;

    // Scan backwards to find the most recent message (presumably the one just sent)
    for (let i = messages.length - 1; i >= 0; i--) {
        const row = messages[i] as HTMLElement;
        if (row.classList.contains(CONSTANTS.CSS_CLASSES.STATS_INJECTED)) continue;

        const body = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_BODY);
        if (!body) continue;

        // Simple check for the specific trackId
        const hasPixel = !!body.querySelector(`img[src*="${trackId}"]`);
        if (!hasPixel) continue;

        // Verify sender matches if we have the hint
        if (currentUserEmail) {
            const senderEmail = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SENDER_SPAN)?.getAttribute('email');
            if (senderEmail && senderEmail.toLowerCase() !== currentUserEmail.toLowerCase()) continue;
        }

        return injectBadgeToMessageRow(row, trackId, currentUserEmail);
    }
    return false;
}

/**
 * Periodically scans the document for tracked emails and injects badges.
 */
export function injectStats() {
    if (!chrome.runtime?.id) return;

    try {
        chrome.storage.local.get([CONSTANTS.STORAGE_KEYS.USER_PROFILE, CONSTANTS.STORAGE_KEYS.CURRENT_USER], async (result) => {
            if (chrome.runtime?.lastError) return;

            const userProfile = result[CONSTANTS.STORAGE_KEYS.USER_PROFILE] as { email: string } | undefined;
            const currentUser = result[CONSTANTS.STORAGE_KEYS.CURRENT_USER] as string | undefined;

            const rawLocalEmails = await LocalStorageService.getCachedEmails();
            if (rawLocalEmails.length === 0) return;

            const activeIdentity = resolveActiveIdentity(userProfile?.email || currentUser || null, rawLocalEmails);
            const ownedLocalIds = new Set(rawLocalEmails.map(e => e.id));
            const trackIdToSender = new Map(rawLocalEmails.map(e => [e.id, e.user?.toLowerCase()]));

            const messages = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.MESSAGE_ROW);
            messages.forEach((row) => {
                const htmlRow = row as HTMLElement;
                if (htmlRow.classList.contains(CONSTANTS.CSS_CLASSES.STATS_INJECTED)) return;

                const body = htmlRow.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_BODY);
                if (!body) return;

                // Find Tracking Pixel
                const imgs = body.querySelectorAll('img');
                let trackId = null;
                for (const img of Array.from(imgs)) {
                    if (img.closest('.gmail_quote') || img.closest('.im')) continue;
                    const match = img.src.match(CONSTANTS.REGEX.TRACKING_ID);
                    if (match && ownedLocalIds.has(match[1])) {
                        trackId = match[1];
                        break;
                    }
                }

                if (trackId) {
                    const senderEmail = htmlRow.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SENDER_SPAN)?.getAttribute('email')?.toLowerCase();
                    const pixelOwnerEmail = trackIdToSender.get(trackId);

                    if (senderEmail && pixelOwnerEmail && senderEmail !== pixelOwnerEmail) return;

                    injectBadgeToMessageRow(htmlRow, trackId, activeIdentity);
                }
            });
        });
    } catch { /* Context invalidated */ }
}

/**
 * Helper: Finalizes badge injection for a specific row.
 */
function injectBadgeToMessageRow(row: HTMLElement, trackId: string, identity: string | null): boolean {
    const dateElement = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_DATE_EL);
    const subjectHeader = (row as HTMLElement).closest('.gs')?.parentElement?.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SUBJECT_H2);
    const anchor = dateElement || subjectHeader;

    if (anchor && anchor.parentElement) {
        const statsContainer = document.createElement('span');
        statsContainer.className = CONSTANTS.CSS_CLASSES.INJECT_ROOT;
        statsContainer.onclick = (e) => e.stopPropagation();

        if (anchor.nextSibling) anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
        else anchor.parentElement.appendChild(statsContainer);

        row.classList.add(CONSTANTS.CSS_CLASSES.STATS_INJECTED);
        createRoot(statsContainer).render(
            <I18nProvider>
                <StatsDisplay trackId={trackId} senderHint={identity || undefined} />
            </I18nProvider>
        );
        return true;
    }
    return false;
}

/**
 * Helper: Resolve the most likely identity of the current mailbox owner.
 */
function resolveActiveIdentity(explicitEmail: string | null, history: LocalEmailMetadata[]): string | null {
    if (explicitEmail) return explicitEmail.toLowerCase();
    
    const detectorEmail = IdentityDetector.detectMailboxOwner();
    if (detectorEmail) return detectorEmail.toLowerCase();

    // Fallback: Statistical guess from history
    const ownerEmails = history.map(e => e.ownerEmail).filter((e): e is string => !!e);
    if (ownerEmails.length === 0) return null;

    const counts = ownerEmails.reduce((acc: Record<string, number>, email) => {
        acc[email] = (acc[email] || 0) + 1;
        return acc;
    }, {});
    
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0].toLowerCase();
}
