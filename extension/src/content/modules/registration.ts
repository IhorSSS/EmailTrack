import { logger } from '../../utils/logger';
import { LocalStorageService } from '../../services/LocalStorageService';
import { handleOptimisticBadge } from './stats';
import { CONSTANTS } from '../../config/constants';

/**
 * Helper to extract user email from Gmail UI using centralized selectors.
 */
function extractUserEmail(): string | null {
    const emailElement = document.querySelector(CONSTANTS.GMAIL_SELECTORS.USER_EMAIL);
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
        if (!event.data || event.data.type !== CONSTANTS.MESSAGES.EMAILTRACK_REGISTER) return;

        logger.log('[Registration] EMAILTRACK_REGISTER received:', event.data.detail.id);
        const { id, subject, recipient, cc, bcc, body, threadId } = event.data.detail;

        if (!id) {
            logger.warn('[Registration] Ignored registration event: missing ID');
            return;
        }

        const userEmail = extractUserEmail();
        
        // Persist current user for popup and settings context
        if (userEmail && chrome.runtime?.id) {
            chrome.storage.local.set({ [CONSTANTS.STORAGE_KEYS.CURRENT_USER]: userEmail });
        }

        const fallbackNoSubject = chrome.i18n.getMessage('detail_no_subject') || '(No Subject)';
        const fallbackUnknownRecipient = chrome.i18n.getMessage('recipient_unknown') || 'Unknown';
        const fallbackUnknownUser = chrome.i18n.getMessage('data_unknown_user') || 'Unknown User';

        // 1. Save to Local Storage (Immediate feedback/offline support)
        try {
            await LocalStorageService.saveEmail({
                id,
                subject: subject || fallbackNoSubject,
                recipient: recipient || fallbackUnknownRecipient,
                cc,
                bcc,
                body: body || '',
                user: userEmail || fallbackUnknownUser,
                threadId: threadId || undefined,
                createdAt: new Date().toISOString()
            });
        } catch (e) {
            logger.error('[Registration] Local save failed:', e);
        }

        // 2. Delegate to Background for Sync
        if (chrome.runtime?.id) {
            chrome.runtime.sendMessage({
                type: CONSTANTS.MESSAGES.REGISTER_EMAIL,
                data: {
                    id,
                    subject: subject || fallbackNoSubject,
                    recipient: recipient || fallbackUnknownRecipient,
                    cc,
                    bcc,
                    body: body || '',
                    user: userEmail || fallbackUnknownUser,
                    threadId: threadId || undefined
                }
            }, (response) => {
                if (chrome.runtime?.lastError) {
                    logger.error('[Registration] Sync message failed:', chrome.runtime.lastError.message);
                    return;
                }
                if (response?.success) {
                    LocalStorageService.markAsSynced([id]).catch(err => 
                        logger.error('[Registration] Failed to mark as synced:', err)
                    );
                }
            });
        }

        // 3. Optimistic UI Injection with Backoff
        const attemptInject = (attempt = 1) => {
            if (handleOptimisticBadge(id, userEmail)) {
                logger.log(`[Registration] UI Badge injected (Attempt ${attempt})`);
            } else if (attempt < CONSTANTS.CONTENT.BADGE_INJECTION_MAX_ATTEMPTS) {
                setTimeout(() => attemptInject(attempt + 1), CONSTANTS.CONTENT.BADGE_INJECTION_RETRY_MS * attempt);
            } else {
                const isMessageView = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.MESSAGE_ROW).length > 0;
                if (isMessageView) {
                    logger.warn(`[Registration] UI Injection failed after ${CONSTANTS.CONTENT.BADGE_INJECTION_MAX_ATTEMPTS} attempts`);
                }
            }
        };

        setTimeout(() => attemptInject(1), CONSTANTS.CONTENT.BADGE_INJECTION_RETRY_MS);
    });
}

