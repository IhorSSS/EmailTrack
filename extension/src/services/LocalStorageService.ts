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
                ownerEmail: email.ownerEmail,
                createdAt: email.createdAt,
                synced: true,
                openCount: email.openCount ?? 0
            });
        });

        const updated = Array.from(map.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        await this.setEmails(updated);
    }

    /**
     * Save email metadata to local storage
     */
    /**
     * Save email metadata to local storage
     */
    static async saveEmail(email: LocalEmailMetadata): Promise<void> {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) {
                    return resolve(); // Fail silently
                }
                chrome.storage.local.get([STORAGE_KEY], (result) => {
                    if (chrome.runtime.lastError) return resolve();

                    const history = (result[STORAGE_KEY] || []) as LocalEmailMetadata[];

                    // Check if email already exists
                    const existingIndex = history.findIndex(e => e.id === email.id);
                    if (existingIndex >= 0) {
                        // Update existing - preserve synced status
                        history[existingIndex] = { ...history[existingIndex], ...email };
                    } else {
                        // New email - mark as unsynced for future upload
                        history.unshift({ ...email, synced: false });
                    }

                    chrome.storage.local.set({ [STORAGE_KEY]: history }, () => {
                        resolve();
                    });
                });
            } catch (e) {
                resolve(); // Fail silently
            }
        });
    }

    /**
     * Get all locally stored emails
     */
    static async getEmails(): Promise<LocalEmailMetadata[]> {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) {
                    return resolve([]);
                }
                chrome.storage.local.get([STORAGE_KEY], (result) => {
                    if (chrome.runtime.lastError) return resolve([]);
                    resolve((result[STORAGE_KEY] || []) as LocalEmailMetadata[]);
                });
            } catch (e) {
                resolve([]);
            }
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
     * Update the owner of local emails (used during Sync migration)
     */
    static async updateOwnership(ids: string[], newUser: string): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                const history = (result[STORAGE_KEY] || []) as LocalEmailMetadata[];
                const updated = history.map(e => {
                    if (ids.includes(e.id)) {
                        return { ...e, user: newUser, ownerEmail: newUser };
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
     * Delete only emails that have already been synced to the cloud.
     * This is used when switching accounts to keep anonymous history while
     * protecting the privacy of the previous user.
     */
    static async deleteSyncedOnly(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                const history = (result[STORAGE_KEY] || []) as LocalEmailMetadata[];
                const unsynced = history.filter(e => !e.synced);
                chrome.storage.local.set({ [STORAGE_KEY]: unsynced }, () => {
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
     * Clean up storage
     */
    static async cleanup(): Promise<void> {
        // No-op for now
    }

    // --- RETRY QUEUE FOR FAILED DELETIONS ---

    static async queuePendingDelete(ids: string[], user?: string): Promise<void> {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) return resolve();
                chrome.storage.local.get(['pending_deletes'], (result) => {
                    if (chrome.runtime.lastError) return resolve();
                    const queue = (result['pending_deletes'] || []) as { ids: string[], user?: string }[];
                    queue.push({ ids, user });
                    chrome.storage.local.set({ 'pending_deletes': queue }, resolve);
                });
            } catch (e) { resolve(); }
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
