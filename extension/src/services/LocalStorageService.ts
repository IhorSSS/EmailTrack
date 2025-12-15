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
     * Delete persistent history (clear all)
     */
    static async clearAll(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.remove(STORAGE_KEY, () => {
                resolve();
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
