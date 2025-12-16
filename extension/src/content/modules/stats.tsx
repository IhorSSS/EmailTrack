import { createRoot } from 'react-dom/client';

import StatsDisplay from '../components/StatsDisplay';
import { logger } from '../../utils/logger';
import { LocalStorageService } from '../../services/LocalStorageService';

const STATS_INJECT_CLASS = 'email-track-stats-injected';

export function handleOptimisticBadge(trackId: string): boolean {
    const messages = document.querySelectorAll('div.adn');
    if (messages.length === 0) return false;

    // Target the last message (most recent)
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.classList.contains(STATS_INJECT_CLASS)) return true;

    // Find Anchor
    const dateElement = lastMessage.querySelector('.gH');
    const subjectHeader = lastMessage.closest('.gs')?.parentElement?.querySelector('h2.hP');
    const anchor = dateElement || subjectHeader;

    if (anchor && anchor.parentElement) {
        logger.log('EmailTrack: [UI] Optimistically injecting badge for', trackId);
        const statsContainer = document.createElement('span');
        statsContainer.style.marginLeft = '10px';
        statsContainer.style.display = 'inline-flex';
        statsContainer.style.alignItems = 'center';
        statsContainer.style.verticalAlign = 'middle';
        statsContainer.style.position = 'relative';

        statsContainer.onclick = (e) => e.stopPropagation();

        if (anchor.nextSibling) {
            anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
        } else {
            anchor.parentElement.appendChild(statsContainer);
        }

        lastMessage.classList.add(STATS_INJECT_CLASS);
        createRoot(statsContainer).render(<StatsDisplay trackId={trackId} />);
        return true;
    }

    return false;
}

export function injectStats() {
    // PRIVACY: Only show badges if user has access rights
    chrome.storage.sync.get(['userProfile'], async (syncResult) => {
        const hasCloudAccess = !!syncResult.userProfile;

        // If not logged in, check for local history
        if (!hasCloudAccess) {
            try {
                const localEmails = await LocalStorageService.getEmails();
                if (localEmails.length === 0) {
                    return; // No access
                }
            } catch (e) {
                return; // Fail-safe
            }
        }

        // User has access - proceed
        const messages = document.querySelectorAll('div.adn');

        messages.forEach((row) => {
            const body = row.querySelector('.a3s');
            if (!body) return;

            // Skip if already injected
            if (row.classList.contains(STATS_INJECT_CLASS)) return;

            const imgs = body.querySelectorAll('img');
            let trackId = null;

            // Scan images but STRICTLY EXCLUDE those inside quoted text.
            let uniquePixels: { id: string }[] = [];

            for (const img of imgs) {
                if (img.closest('.gmail_quote') || img.closest('.im')) {
                    continue;
                }

                const rawSrc = img.src;
                let decodedSrc = rawSrc;
                try { decodedSrc = decodeURIComponent(rawSrc); } catch { }

                const uuidRegex = /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
                const match = rawSrc.match(uuidRegex) || decodedSrc.match(uuidRegex);

                if (match) {
                    uniquePixels.push({ id: match[1] });
                }
            }

            if (uniquePixels.length > 0) {
                trackId = uniquePixels[0].id;
            }

            if (trackId) {
                // Find Injection Point: .gH (Date/Header) prioritized
                const dateElement = row.querySelector('.gH');
                const subjectHeader = row.closest('.gs')?.parentElement?.querySelector('h2.hP');
                const anchor = dateElement || subjectHeader;

                if (anchor && anchor.parentElement) {
                    const statsContainer = document.createElement('span');
                    statsContainer.style.marginLeft = '10px';
                    statsContainer.style.display = 'inline-flex';
                    statsContainer.style.alignItems = 'center';
                    statsContainer.style.verticalAlign = 'middle';
                    statsContainer.style.position = 'relative';

                    statsContainer.onclick = (e) => e.stopPropagation();

                    if (anchor.nextSibling) {
                        anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
                    } else {
                        anchor.parentElement.appendChild(statsContainer);
                    }

                    row.classList.add(STATS_INJECT_CLASS);
                    createRoot(statsContainer).render(<StatsDisplay trackId={trackId} />);
                }
            }
        });
    });
}
