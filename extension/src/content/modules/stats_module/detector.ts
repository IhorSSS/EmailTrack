import { logger } from '../../../utils/logger';
import { CONSTANTS } from '../../../config/constants';

export class IdentityDetector {
    /**
     * Detects the current Gmail mailbox owner from the UI
     */
    static detectMailboxOwner(): string | null {
        try {
            // 1. Try account switcher
            const switcher = document.querySelector(CONSTANTS.GMAIL_SELECTORS.GMAIL_ACCOUNT_SWITCHER_SELECTOR);
            if (switcher) {
                const label = switcher.getAttribute('aria-label');
                const match = label?.match(CONSTANTS.REGEX.GMAIL_IDENTITY_LABEL);
                if (match) return match[1].toLowerCase();
            }
            // 2. Try title
            const title = document.title;
            const match = title.match(CONSTANTS.REGEX.GMAIL_IDENTITY_TITLE);
            if (match) return match[1].toLowerCase();
        } catch (err: unknown) {
            logger.error('Identity detection failed', err);
        }
        return null;
    }
}
