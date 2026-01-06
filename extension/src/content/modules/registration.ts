import { logger } from '../../utils/logger';
import { LocalStorageService } from '../../services/LocalStorageService';
import { handleOptimisticBadge } from './stats';

// --- Helper to extract user email from Gmail UI ---
function extractUserEmail(): string | null {
    // Try Gmail's user email element
    const emailElement = document.querySelector('.gb_Ha.gb_i, [aria-label*="@"]');
    if (emailElement && emailElement.getAttribute('aria-label')) {
        const label = emailElement.getAttribute('aria-label');
        const match = label?.match(/\(([^)]+)\)/);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

export function setupRegistrationListener() {
    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.type !== 'EMAILTRACK_REGISTER') return;

        logger.log('[Content] EMAILTRACK_REGISTER event received:', event.data.detail);
        const { id, subject, recipient, cc, bcc, body } = event.data.detail;

        // Validation: Only require ID (subject can be empty in Gmail)
        if (!id) {
            logger.warn('[Content] Ignoring registration event without ID:', event.data.detail);
            return;
        }

        const userEmail = extractUserEmail();
        logger.log('[Content] Extracted user email:', userEmail);

        // Save Current User to Local Storage for Popup usage
        if (userEmail && chrome.runtime?.id) {
            chrome.storage.local.set({ currentUser: userEmail }, () => {
                if (chrome.runtime?.lastError) {
                    // ignore
                }
            });
        }

        // 1. Save Metadata to Local Storage (Incognito)
        try {
            await LocalStorageService.saveEmail({
                id,
                subject: subject || chrome.i18n.getMessage('detail_no_subject'),
                recipient: recipient || chrome.i18n.getMessage('recipient_unknown'),
                cc,
                bcc,
                body: body || '',
                user: userEmail || chrome.i18n.getMessage('data_unknown_user'),
                createdAt: new Date().toISOString()
            });
            logger.log('[Content] Saved metadata locally.');
        } catch (e) {
            logger.error('[Content] Failed to save local metadata:', e);
        }

        // 2. Register with Backend via Background Script (Delegation)
        try {
            chrome.runtime.sendMessage({
                type: 'REGISTER_EMAIL',
                data: {
                    id,
                    subject: subject || chrome.i18n.getMessage('detail_no_subject'),
                    recipient: recipient || chrome.i18n.getMessage('recipient_unknown'),
                    cc,
                    bcc,
                    body: body || '',
                    user: userEmail || chrome.i18n.getMessage('data_unknown_user') // Pass extracted sender
                }
            }, (response) => {
                if (chrome.runtime?.lastError) {
                    logger.error('[Content] Background registration error:', chrome.runtime.lastError);
                    return;
                }
                if (response && response.success) {
                    logger.log('[Content] Successfully registered email via background');
                    // Mark as synced locally
                    LocalStorageService.markAsSynced([id]).then(() => {
                        logger.log('[Content] Marked email as synced locally.');
                    });
                } else {
                    logger.warn('[Content] Background registration returned failure:', response);
                }
            });
        } catch (err) {
            logger.error('[Content] Failed to send message to background:', err);
        }

        // 2. Optimistic UI Update (With Retries)
        // 2. Optimistic UI Update (With Retries)
        const attemptInject = (attempt = 1) => {
            const success = handleOptimisticBadge(id, userEmail);
            if (success) {
                logger.log(`EmailTrack: [UI] Badge Injected on attempt ${attempt}`);
            } else if (attempt < 5) {
                // Retry with backoff (500ms, 1000ms... 2500ms)
                setTimeout(() => attemptInject(attempt + 1), 500 * attempt);
            } else {
                // Determine if we are even in a message view
                const isMessageView = document.querySelectorAll('div.adn').length > 0;

                if (isMessageView) {
                    logger.warn('EmailTrack: [UI] Failed to inject optimistic badge after 5 attempts');
                } else {
                    logger.log('EmailTrack: [UI] Stopped retrying badge injection - user likely navigated away or view changed.');
                }
            }
        };

        setTimeout(() => attemptInject(1), 500);
    });
}
