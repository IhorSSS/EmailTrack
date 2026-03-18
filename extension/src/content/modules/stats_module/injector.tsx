import { createRoot } from 'react-dom/client';
import StatsDisplay from '../../components/StatsDisplay';
import { logger } from '../../../utils/logger';
import { LocalStorageService } from '../../../services/LocalStorageService';
import { I18nProvider } from '../../../hooks/useTranslation';
import { IdentityDetector } from './detector';
import { CONSTANTS } from '../../../config/constants';
import type { LocalEmailMetadata } from '../../../types';


const STATS_INJECT_CLASS = 'email-track-stats-injected';

export function handleOptimisticBadge(trackId: string, currentUserEmail: string | null): boolean {
    const messages = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.MESSAGE_ROW);
    if (messages.length === 0) return false;

    for (let i = messages.length - 1; i >= 0; i--) {
        const lastMessage = messages[i] as HTMLElement;

        if (lastMessage.classList.contains(STATS_INJECT_CLASS)) continue;

        const body = lastMessage.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_BODY);
        if (!body) continue;

        const imgs = body.querySelectorAll('img');
        let hasPixel = false;
        for (const img of Array.from(imgs)) {
            if (img.closest('.gmail_quote') || img.closest('.im') || img.closest('blockquote')) continue;
            if (img.src.includes(trackId)) {
                hasPixel = true;
                break;
            }
        }

        if (!hasPixel) continue;

        if (currentUserEmail) {
            const senderElement = lastMessage.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SENDER_SPAN);
            const senderEmail = senderElement?.getAttribute('email');
            if (senderEmail && senderEmail !== currentUserEmail) continue;
        }

        const dateElement = lastMessage.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_DATE_EL);
        const subjectHeader = lastMessage.closest('.gs')?.parentElement?.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SUBJECT_H2);
        const anchor = dateElement || subjectHeader;

        if (anchor && anchor.parentElement) {
            logger.log('EmailTrack: [UI] Optimistically injecting badge for', trackId);
            const statsContainer = document.createElement('span');
            statsContainer.className = 'et-inject-root';
            statsContainer.onclick = (e) => e.stopPropagation();

            if (anchor.nextSibling) anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
            else anchor.parentElement.appendChild(statsContainer);

            lastMessage.classList.add(STATS_INJECT_CLASS);
            createRoot(statsContainer).render(
                <I18nProvider>
                    <StatsDisplay trackId={trackId} senderHint={currentUserEmail || undefined} />
                </I18nProvider>
            );
            return true;
        }
    }
    return false;
}

export function injectStats() {
    if (!chrome.runtime?.id) return;

    try {
        chrome.storage.local.get([CONSTANTS.STORAGE_KEYS.USER_PROFILE, CONSTANTS.STORAGE_KEYS.CURRENT_USER], async (result) => {
            if (chrome.runtime?.lastError) return;

            const userProfile = result[CONSTANTS.STORAGE_KEYS.USER_PROFILE] as { email: string } | undefined;
            const currentUser = result[CONSTANTS.STORAGE_KEYS.CURRENT_USER] as string | undefined;

            const rawLocalEmails: LocalEmailMetadata[] = await LocalStorageService.getEmails();

            let extensionIdentity = (userProfile?.email || currentUser)?.toLowerCase();

            if (!extensionIdentity && rawLocalEmails.length > 0) {
                const ownerEmails = rawLocalEmails
                    .map(e => e.ownerEmail)
                    .filter((email): email is string => !!email);
                if (ownerEmails.length > 0) {
                    const counts = ownerEmails.reduce((acc: Record<string, number>, email) => {
                        acc[email] = (acc[email] || 0) + 1;
                        return acc;
                    }, {});
                    const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                    if (sortedEntries.length > 0) {
                        extensionIdentity = sortedEntries[0][0].toLowerCase();
                    }
                }
            }

            const mailboxOwner = IdentityDetector.detectMailboxOwner();
            const activeIdentity = extensionIdentity || mailboxOwner;

            const ownedLocalIds: Set<string> = new Set();
            const trackIdToSender = new Map<string, string>();

            rawLocalEmails.forEach(e => {
                ownedLocalIds.add(e.id);
                if (e.user) trackIdToSender.set(e.id, e.user.toLowerCase());
            });

            if (ownedLocalIds.size === 0) return;

            const messages = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.MESSAGE_ROW);
            messages.forEach((row) => {
                const body = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_BODY);
                if (!body || row.classList.contains(STATS_INJECT_CLASS)) return;

                const imgs = body.querySelectorAll('img');
                let trackId = null;
                const uniquePixels: { id: string }[] = [];

                for (const img of Array.from(imgs)) {
                    if (img.closest('.gmail_quote') || img.closest('.im') || img.closest('blockquote')) continue;
                    const match = img.src.match(CONSTANTS.REGEX.TRACKING_ID);
                    if (match) uniquePixels.push({ id: match[1] });
                }

                if (uniquePixels.length > 0) trackId = uniquePixels[0].id;

                if (trackId && ownedLocalIds.has(trackId)) {
                    const messageSenderEl = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SENDER_SPAN);
                    const messageSenderEmail = messageSenderEl?.getAttribute('email')?.toLowerCase();
                    const pixelOwnerEmail = trackIdToSender.get(trackId);

                    if (messageSenderEmail && pixelOwnerEmail && messageSenderEmail !== pixelOwnerEmail) {
                        return;
                    }

                    const anchor = row.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_DATE_EL) || (row as HTMLElement).closest('.gs')?.parentElement?.querySelector(CONSTANTS.GMAIL_SELECTORS.MESSAGE_SUBJECT_H2);

                    if (anchor && anchor.parentElement) {
                        const statsContainer = document.createElement('span');
                        statsContainer.className = 'et-inject-root';
                        statsContainer.onclick = (e) => e.stopPropagation();

                        if (anchor.nextSibling) anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
                        else anchor.parentElement.appendChild(statsContainer);

                        row.classList.add(STATS_INJECT_CLASS);
                        createRoot(statsContainer).render(
                            <I18nProvider>
                                <StatsDisplay trackId={trackId} senderHint={activeIdentity || undefined} />
                            </I18nProvider>
                        );
                    }
                }
            });
        });
    } catch { /* Context invalidated */ }
}
