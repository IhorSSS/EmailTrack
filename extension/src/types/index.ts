export interface TrackedEmail {
    id: string;
    recipient: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body?: string;
    user?: string; // Sender identity
    createdAt: string;
    opens: any[];
    openCount: number;
    ownerEmail?: string; // Grouping ID for multi-sender accounts
    ownerId?: string | null;  // Backend UUID (presence means owned)
    _count?: { opens: number }; // Backend format
}

export interface LocalEmailMetadata {
    id: string;
    recipient: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body?: string;
    user: string; // The sender email
    ownerEmail?: string; // Grouping ID for multi-sender accounts
    createdAt: string;
    synced?: boolean;
    isOwned?: boolean; // True if item belongs to a registered account
    openCount?: number;
}
