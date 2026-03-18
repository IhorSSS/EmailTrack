import { logger } from '../../../utils/logger';

export class IdentityDetector {
    /**
     * Detects the current Gmail mailbox owner from the UI
     */
    static detectMailboxOwner(): string | null {
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
            logger.error('Identity detection failed', e);
        }
        return null;
    }
}
