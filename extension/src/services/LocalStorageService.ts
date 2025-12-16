import type { LocalEmailMetadata, TrackedEmail } from '../types';

const STORAGE_KEY = 'emailtrack_local_history';

export class LocalStorageService {
    /**
     * Save multiple tracked emails (Batch)
     */
    static async saveEmails(emailsToSave: TrackedEmail[]): Promise<void> {
        const local = await this.getEmails();
        const map = new Map(local.map(e => [e.id, e]));

        emailsToSave.forEach(email => {
            // Actually, if we just store full objects, we might pollute types?
            // LocalEmailMetadata is a subset.
            // Let's just cast or ensure fields.
            map.set(email.id, {
                id: email.id,
                recipient: email.recipient,
                subject: email.subject,
                body: email.body, // Now optional
                user: email.user || '',
                createdAt: email.createdAt,
                synced: true
            });
        });

        const updated = Array.from(map.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        await this.setEmails(updated);
    }

    /**
     * Save email metadata to local storage
     */
    static async saveEmail(email: LocalEmailMetadata): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                const history = (result[STORAGE_KEY] || []) as LocalEmailMetadata[];
                // Prepend new email
                history.unshift(email);

                // Optional: Limit local history size? (e.g. 1000 items)

                chrome.storage.local.set({ [STORAGE_KEY]: history }, () => {
                    resolve();
                });
            });
        });
    }

    /**
     * Get all locally stored emails
     */
    static async getEmails(): Promise<LocalEmailMetadata[]> {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                resolve((result[STORAGE_KEY] || []) as LocalEmailMetadata[]);
            });
        });
    }

    /**
     * Mark emails as safely synced to cloud
     */
    static async markAsSynced(ids: string[]): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                const history = (result[STORAGE_KEY] || []) as LocalEmailMetadata[];
                const updated = history.map(e => {
                    if (ids.includes(e.id)) {
                        return { ...e, synced: true };
                    }
                    return e;
                });
                chrome.storage.local.set({ [STORAGE_KEY]: updated }, () => {
                    resolve();
                });
            });
        });
    }

    /**
     * Overwrite all emails (Internal)
     */
    private static async setEmails(emails: LocalEmailMetadata[]): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [STORAGE_KEY]: emails }, () => {
                resolve();
            });
        });
    }

    /**
     * Delete persistent history (clear all)
     */
    static async deleteAll(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.remove(STORAGE_KEY, () => {
                resolve();
            });
        });
    }

    /**
     * Delete persistent history (clear all) - Alias for backward compatibility if needed, 
     * but we should use deleteAll for explicit intent.
     */
    static async clearAll(): Promise<void> {
        return this.deleteAll();
    }

    /**
     * Delete emails by Sender Identity (for Incognito cleanup)
     */
    static async deleteBySender(sender: string): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                let history = (result[STORAGE_KEY] || []) as LocalEmailMetadata[];
                history = history.filter(e => e.user !== sender);
                chrome.storage.local.set({ [STORAGE_KEY]: history }, () => {
                    resolve();
                });
            });
        });
    }

    /**
     * Delete single email by ID
     */
    static async deleteEmail(id: string): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                let history = (result[STORAGE_KEY] || []) as LocalEmailMetadata[];
                history = history.filter(e => e.id !== id);
                chrome.storage.local.set({ [STORAGE_KEY]: history }, () => {
                    resolve();
                });
            });
        });
    }

    /**
     * Clean up storage
     */
    static async cleanup(): Promise<void> {
        // No-op for now
    }

    // --- RETRY QUEUE FOR FAILED DELETIONS ---

    static async queuePendingDelete(ids: string[], user?: string): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get(['pending_deletes'], (result) => {
                const queue = (result['pending_deletes'] || []) as { ids: string[], user?: string }[];
                queue.push({ ids, user });
                chrome.storage.local.set({ 'pending_deletes': queue }, resolve);
            });
        });
    }

    static async getPendingDeletes(): Promise<{ ids: string[], user?: string }[]> {
        return new Promise((resolve) => {
            chrome.storage.local.get(['pending_deletes'], (result) => {
                resolve((result['pending_deletes'] || []) as { ids: string[], user?: string }[]);
            });
        });
    }

    static async clearPendingDeletes(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.remove(['pending_deletes'], resolve);
        });
    }
}
