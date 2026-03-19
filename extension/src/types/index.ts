export interface OpenEvent {
    id: string;
    ip: string;
    userAgent: string;
    device?: string; // JSON string
    location?: string;
    openedAt?: string;
    timestamp?: string; // Fallback
}

export interface TrackedEmail {
    id: string;
    recipient: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body?: string;
    user?: string; // Sender identity
    createdAt: string;
    opens: OpenEvent[];
    openCount: number;
    threadId?: string; // Gmail thread ID for robust list-view matching
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
    threadId?: string; // Gmail thread ID
    isOwned?: boolean; // True if item belongs to a registered account
    openCount?: number;
    lastOpenedAt?: string;
}
export interface EmailStats {
    tracked: number;
    opened: number;
    rate: number;
}
