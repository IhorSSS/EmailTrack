export { }; // Ensure this is treated as a module

declare global {
    interface Window {
        jQuery: any;
        $: any;
        Gmail: any;
        GmailInstance?: any; // Added for debugging
        __emailTrackPolicy: any;
        trustedTypes?: {
            createPolicy: (name: string, rules: any) => any;
        };
    }
}
