
export class GmailWrapper {
    private gmail: any = null;
    private maxRetries = 100;
    private retryCount = 0;

    private logger: any;

    constructor(logger: any) {
        this.logger = logger;
    }

    init(onReady: (gmail: any) => void) {
        // Ensure jQuery (Gmail.js dependency)
        if (typeof window.jQuery === 'undefined' && typeof window.$ !== 'undefined') {
            window.jQuery = window.$;
        }

        if (typeof window.Gmail === 'undefined' || typeof window.jQuery === 'undefined') {
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
                setTimeout(() => this.init(onReady), 100);
            } else {
                this.logger.error("EmailTrack: [GmailWrapper] Failed to load Gmail.js or jQuery");
            }
            return;
        }

        try {
            this.gmail = new window.Gmail();
            this.logger.log("EmailTrack: [GmailWrapper] Initialized");
            onReady(this.gmail);
        } catch (e) {
            this.logger.error('EmailTrack: [GmailWrapper] Initialization Error:', e);
        }
    }
}
