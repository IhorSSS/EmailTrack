
export interface GoogleAuthInfo {
    id: string; // The sub/id from Google
    email: string;
    googleId: string;
    name?: string;
    picture?: string;
}

export interface EmailData {
    id?: string;

    subject?: string;
    recipient?: string;
    cc?: string | null;
    bcc?: string | null;
    body?: string;
    user?: string;
    ownerId?: string | null;
}

export interface TrackingMetadata {
    device: string;
    os: string;
    browser: string;
    type: string;
    isBot: boolean;
    raw: string;
}

export interface DashboardFilter {
    page: number;
    limit: number;
    user?: string;
    ownerId?: string | null;
    ids?: string[];
    // Resolved owner UUID after auth check
    resolvedOwnerUuid?: string | null;
}

export interface DeleteFilter {
    user?: string;
    ownerId?: string;
    ids?: string[];
    resolvedOwnerUuid?: string | null;
}
