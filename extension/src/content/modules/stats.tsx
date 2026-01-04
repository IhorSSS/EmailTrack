import { createRoot } from 'react-dom/client';

import StatsDisplay from '../components/StatsDisplay';
import { logger } from '../../utils/logger';
import { LocalStorageService } from '../../services/LocalStorageService';

const STATS_INJECT_CLASS = 'email-track-stats-injected';

export function handleOptimisticBadge(trackId: string, currentUserEmail: string | null): boolean {
    const messages = document.querySelectorAll('div.adn');
    if (messages.length === 0) return false;

    // Target the last message (most recent)
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.classList.contains(STATS_INJECT_CLASS)) return true;

    // Check ownership if email is available
    if (currentUserEmail) {
        const senderElement = lastMessage.querySelector('span.gD');
        const senderEmail = senderElement?.getAttribute('email');

        if (senderEmail && senderEmail !== currentUserEmail) {
            // This is likely a received message (reply), not our sent message
            return false;
        }
    }

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
        createRoot(statsContainer).render(<StatsDisplay trackId={trackId} senderHint={currentUserEmail || undefined} />);
        return true;
    }

    return false;
}

function detectMailboxOwner(): string | null {
    try {
        // 1. Try account switcher
        const switcher = document.querySelector('a[aria-label*="Google Account:"]');
        if (switcher) {
            const label = switcher.getAttribute('aria-label');
            const match = label?.match(/\(([^)]+)\)/);
            if (match) return match[1].toLowerCase();
        }
        // 2. Try title
        const title = document.title;
        const match = title.match(/ - ([^ ]+@[^ ]+) - /);
        if (match) return match[1].toLowerCase();
    } catch (e) {
        // Silent
    }
    return null;
}

export function injectStats() {
    // Safety check for invalidated context
    if (!chrome.runtime?.id) return;

    // PRIVACY: Only show badges if user has access rights
    try {
        chrome.storage.local.get(['userProfile', 'currentUser'], async (result) => {
            if (chrome.runtime?.lastError) return;

            // IDENTITY DETECTION
            const userProfile = result.userProfile as { email: string } | undefined;
            const currentUser = result.currentUser as string | undefined;

            const rawLocalEmails = await LocalStorageService.getEmails();
            let extensionIdentity = (userProfile?.email || currentUser)?.toLowerCase();

            // FALLBACK: Infer identity if missing (for legacy sessions)
            if (!extensionIdentity && rawLocalEmails.length > 0) {
                const ownerEmails = rawLocalEmails
                    .map(e => e.ownerEmail)
                    .filter((email): email is string => !!email);
                if (ownerEmails.length > 0) {
                    const counts = ownerEmails.reduce((acc, email) => {
                        acc[email] = (acc[email] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    extensionIdentity = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0].toLowerCase();
                    logger.log(`[Stats] Inferred identity: ${extensionIdentity}`);
                }
            }

            const mailboxOwner = detectMailboxOwner();

            // SECURITY GATE: Prevent cross-account leakage
            // ONLY enforce this if we are in Cloud Mode (have a verified userProfile)
            // or if we have a strict Local Identity locked (currentUser).
            // In pure "Anonymous Local Mode" (no userProfile), we allow all badges.
            if (userProfile && mailboxOwner && extensionIdentity && mailboxOwner !== extensionIdentity) {
                // Mismatch: User is viewing a different Gmail account than the one managed by the extension.
                // We block badges to prevent privacy leaks.
                return;
            }

            const activeIdentity = extensionIdentity || mailboxOwner;

            // Load local manageable IDs (Dashboard Sync)
            let ownedLocalIds: Set<string> = new Set();
            try {
                // OWNED ID FILTERING:
                if (userProfile) {
                    // Cloud Mode: strict sync
                    ownedLocalIds = new Set(rawLocalEmails.map(e => e.id));
                } else {
                    // Local/Anonymous Mode: Show ALL local emails
                    // The user explicitly requested to see badges for ANY tracked email in local mode
                    ownedLocalIds = new Set(rawLocalEmails.map(e => e.id));
                }

                // If no local history -> no access
                if (ownedLocalIds.size === 0) {
                    return;
                }
            } catch (e) {
                return;
            }

            // User has access - proceed
            const messages = document.querySelectorAll('div.adn');

            messages.forEach((row) => {
                const body = row.querySelector('.a3s');
                if (!body) return;

                if (row.classList.contains(STATS_INJECT_CLASS)) return;

                const imgs = body.querySelectorAll('img');
                let trackId = null;
                let uniquePixels: { id: string }[] = [];

                for (const img of imgs) {
                    if (img.closest('.gmail_quote') || img.closest('.im') || img.closest('blockquote')) continue;
                    const rawSrc = img.src;
                    const uuidRegex = /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
                    const match = rawSrc.match(uuidRegex);
                    if (match) uniquePixels.push({ id: match[1] });
                }

                if (uniquePixels.length > 0) trackId = uniquePixels[0].id;

                if (trackId) {
                    if (!ownedLocalIds.has(trackId)) {
                        logger.log(`[Stats] Skipping badge for ${trackId} - not in dashboard sync`);
                        return;
                    }

                    const anchor = row.querySelector('.gH') || row.closest('.gs')?.parentElement?.querySelector('h2.hP');

                    if (anchor && anchor.parentElement) {
                        const statsContainer = document.createElement('span');
                        statsContainer.style.marginLeft = '10px';
                        statsContainer.style.display = 'inline-flex';
                        statsContainer.style.alignItems = 'center';

                        statsContainer.onclick = (e) => e.stopPropagation();

                        if (anchor.nextSibling) {
                            anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
                        } else {
                            anchor.parentElement.appendChild(statsContainer);
                        }

                        row.classList.add(STATS_INJECT_CLASS);
                        createRoot(statsContainer).render(<StatsDisplay trackId={trackId} senderHint={activeIdentity || undefined} />);
                    }
                }
            });
        });
    } catch (e) {
        // Context invalidated
    }
}
