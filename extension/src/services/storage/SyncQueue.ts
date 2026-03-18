import { CONSTANTS } from '../../config/constants';

export class SyncQueue {
    static async queuePendingDelete(ids: string[], user?: string): Promise<void> {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) return resolve();
                chrome.storage.local.get([CONSTANTS.STORAGE_KEYS.PENDING_DELETES], (result) => {
                    if (chrome.runtime.lastError) return resolve();
                    const queue = (result[CONSTANTS.STORAGE_KEYS.PENDING_DELETES] || []) as { ids: string[], user?: string }[];
                    queue.push({ ids, user });
                    chrome.storage.local.set({ [CONSTANTS.STORAGE_KEYS.PENDING_DELETES]: queue }, resolve);
                });
            } catch { resolve(); }
        });
    }

    static async getPendingDeletes(): Promise<{ ids: string[], user?: string }[]> {
        return new Promise((resolve) => {
            chrome.storage.local.get([CONSTANTS.STORAGE_KEYS.PENDING_DELETES], (result) => {
                resolve((result[CONSTANTS.STORAGE_KEYS.PENDING_DELETES] || []) as { ids: string[], user?: string }[]);
            });
        });
    }

    static async clearPendingDeletes(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.remove([CONSTANTS.STORAGE_KEYS.PENDING_DELETES], resolve);
        });
    }
}
