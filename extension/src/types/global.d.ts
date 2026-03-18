export { }; // Ensure this is treated as a module

declare global {
    interface Window {
        jQuery: unknown;
        $: unknown;
        Gmail: unknown;
        GmailInstance?: unknown; // Added for debugging
        __emailTrackPolicy: {
            createHTML: (string: string) => string;
        };
        trustedTypes?: {
            createPolicy: (name: string, rules: { createHTML: (string: string) => string }) => {
                createHTML: (string: string) => string;
            };
        };
    }
}
