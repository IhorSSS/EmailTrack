import type { LocalEmailMetadata } from '../types';

const STORAGE_KEY = 'emailtrack_local_history';

export class LocalStorageService {
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
     * Clean up storage (e.g. remove very old items - optional)
     */
}
