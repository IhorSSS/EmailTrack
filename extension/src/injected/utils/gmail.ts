import { CONSTANTS } from '../../config/constants';

export class GmailWrapper {
    private gmail: unknown = null;
    private maxRetries = 100;
    private retryCount = 0;

    private logger: { log: (...args: unknown[]) => void, error: (...args: unknown[]) => void };

    constructor(logger: { log: (...args: unknown[]) => void, error: (...args: unknown[]) => void }) {
        this.logger = logger;
    }

    init(onReady: (gmail: unknown) => void) {
        // Ensure jQuery (Gmail.js dependency)
        if (typeof window.jQuery === 'undefined' && typeof window.$ !== 'undefined') {
            window.jQuery = window.$;
        }

        if (typeof window.Gmail === 'undefined' || typeof window.jQuery === 'undefined') {
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
                setTimeout(() => this.init(onReady), CONSTANTS.TIMEOUTS.YIELD);
            } else {
                this.logger.error("EmailTrack: [GmailWrapper] Failed to load Gmail.js or jQuery");
            }
            return;
        }

        try {
            // @ts-expect-error Gmail.js is dynamically loaded and not fully typed
            this.gmail = new window.Gmail();
            this.logger.log("EmailTrack: [GmailWrapper] Initialized");
            onReady(this.gmail);
        } catch (e) {
            this.logger.error('EmailTrack: [GmailWrapper] Initialization Error:', e);
        }
    }
}
