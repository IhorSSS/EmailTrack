import { createRoot } from 'react-dom/client';

import StatsDisplay from '../components/StatsDisplay';
import { logger } from '../../utils/logger';
import { LocalStorageService } from '../../services/LocalStorageService';

/**
 * Extract the mailbox owner's email from the Gmail DOM.
 * This handles cases where extension storage hasn't synced the profile yet.
 */
function extractMailboxOwner(): string | null {
    try {
        const profileBtn = document.querySelector('a[aria-label*="@"][href*="SignOutOptions"]');
        if (profileBtn) {
            const ariaLabel = profileBtn.getAttribute('aria-label');
            const match = ariaLabel?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
            if (match) return match[1].toLowerCase();
        }
        return null;
    } catch (e) {
        return null;
    }
}

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

export function injectStats() {
    // Safety check for invalidated context
    if (!chrome.runtime?.id) return;

    // PRIVACY: Only show badges if user has access rights
    // Fix: Read from 'local' because useAuth saves to 'local'
    try {
        chrome.storage.local.get(['userProfile', 'currentUser'], async (result) => {
            if (chrome.runtime?.lastError) return;

            const userProfile = result.userProfile as { email: string } | undefined;
            const currentUser = result.currentUser as string | undefined;
            let activeEmail = (userProfile?.email || currentUser)?.toLowerCase();
            const hasCloudAccess = !!userProfile;

            // FALLBACK: If storage is empty, try to get identity from DOM to enforce privacy.
            if (!activeEmail) {
                activeEmail = extractMailboxOwner() || undefined;
            }

            // Load and filter local emails for ownership validation
            let ownedLocalIds: Set<string> = new Set();
            let allLocalIds: Set<string> = new Set(); // Initialize allLocalIds
            try {
                const allLocalEmails = await LocalStorageService.getEmails();
                allLocalIds = new Set(allLocalEmails.map(e => e.id)); // Populate allLocalIds
                ownedLocalIds = new Set(
                    allLocalEmails
                        .filter(e => e.user?.toLowerCase() === activeEmail)
                        .map(e => e.id)
                );

                // If no active identity and no local history -> no access
                if (!activeEmail && ownedLocalIds.size === 0) {
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

                // Skip if already injected
                if (row.classList.contains(STATS_INJECT_CLASS)) return;

                const imgs = body.querySelectorAll('img');
                let trackId = null;

                // Scan images but STRICTLY EXCLUDE those inside quoted text.
                let uniquePixels: { id: string }[] = [];

                for (const img of imgs) {
                    if (img.closest('.gmail_quote') || img.closest('.im') || img.closest('blockquote')) {
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
                    // SENDER VALIDATION (DOM Check)
                    // Ensure the visual sender matches the active extension identity.
                    if (activeEmail) {
                        const senderElement = row.querySelector('span.gD');
                        const senderEmail = senderElement?.getAttribute('email')?.toLowerCase();

                        // Skip if visible sender is not the active user
                        if (senderEmail && senderEmail !== activeEmail) {
                            logger.log(`[Stats] Skipping badge for ${trackId} - DOM sender ${senderEmail} !== active ${activeEmail}`);
                            return;
                        }
                    } else {
                        // CRITICAL PRIVACY: If we don't know who the active user is, 
                        // we MUST NOT show badges, as we can't verify they own the email.
                        logger.log(`[Stats] Skipping badge for ${trackId} - active user identity unknown`);
                        return;
                    }

                    // OWNERSHIP VALIDATION
                    // 1. STRICT LOCAL CHECK:
                    // If the email exists locally (in allLocalIds) but does NOT belong to the current user (not in ownedLocalIds),
                    // then it belongs to another local identity. Block it immediately.
                    if (allLocalIds.has(trackId) && !ownedLocalIds.has(trackId)) {
                        logger.log(`[Stats] Skipping badge for ${trackId} - exists locally but belongs to another identity`);
                        return;
                    }

                    // 2. Further validation based on cloud access
                    // Cloud mode: Show badge, let StatsDisplay + backend validate ownership (returns 404 if not owned)
                    // Offline mode: Must be in ownedLocalIds (already checked by the first condition if it's in allLocalIds)
                    // If not in allLocalIds, and no cloud access, we can't show it.
                    if (!hasCloudAccess && !ownedLocalIds.has(trackId)) {
                        logger.log(`[Stats] Skipping badge for ${trackId} - not in local storage and no cloud access`);
                        return; // Skip - not owned in current session and no cloud to verify
                    }
                    // In cloud mode: localEmailIds might be empty before popup sync, so we let backend decide

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
                        createRoot(statsContainer).render(<StatsDisplay trackId={trackId} senderHint={activeEmail || undefined} />);
                    }
                }
            });
        });
    } catch (e) {
        // Context invalidated
    }
}
