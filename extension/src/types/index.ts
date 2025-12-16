export interface TrackedEmail {
    id: string;
    recipient: string;
    subject: string;
    body?: string;
    user?: string; // Sender identity
    createdAt: string;
    opens: any[];
    openCount: number;
    _count?: { opens: number }; // Backend format
}

export interface LocalEmailMetadata {
    id: string;
    recipient: string;
    subject: string;
    body?: string;
    user: string; // The sender email
    createdAt: string;
    synced?: boolean;
}
