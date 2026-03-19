import type { LocalEmailMetadata, TrackedEmail } from '../types';
import { EmailStorage } from './storage/EmailStorage';
import { SyncQueue } from './storage/SyncQueue';
import { CONSTANTS } from '../config/constants';

let cachedEmails: LocalEmailMetadata[] = [];
let lastFetchTime = 0;

export interface ExtensionSettings {
    [CONSTANTS.STORAGE_KEYS.TRACKING_ENABLED]?: boolean;
    [CONSTANTS.STORAGE_KEYS.BODY_PREVIEW_LENGTH]?: number;
    [CONSTANTS.STORAGE_KEYS.THEME]?: 'light' | 'dark' | 'system';
    [CONSTANTS.STORAGE_KEYS.SHOW_TRACKING_INDICATOR]?: boolean;
    [CONSTANTS.STORAGE_KEYS.CURRENT_USER]?: string | null;
    [CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL]?: string | null;
}

/**
 * LocalStorageService - Entry point (Facade)
 * Decomposed into EmailStorage and SyncQueue for architectural compliance.
 */
export class LocalStorageService {
    static async saveEmails(emailsToSave: TrackedEmail[]) { return EmailStorage.saveEmails(emailsToSave); }
    static async saveEmail(email: LocalEmailMetadata) { return EmailStorage.saveEmail(email); }
    static async getEmails(): Promise<LocalEmailMetadata[]> {
        return EmailStorage.getEmails();
    }
    static async setEmails(emails: LocalEmailMetadata[]) { return EmailStorage.setEmails(emails); }

    /**
     * Get emails with a 2-second memory cache to prevent storage spam
     * during heavy DOM mutations.
     */
    static async getCachedEmails(): Promise<LocalEmailMetadata[]> {
        const now = Date.now();
        if (now - lastFetchTime > CONSTANTS.TIMEOUTS.THREADLIST_CACHE_MS) {
            cachedEmails = await this.getEmails();
            lastFetchTime = now;
        }
        return cachedEmails;
    }

    static async markAsSynced(ids: string[]): Promise<void> {
        const history = await EmailStorage.getEmails();
        const updated = history.map(e => ids.includes(e.id) ? { ...e, synced: true } : e);
        await EmailStorage.setEmails(updated);
    }

    static async updateOwnership(ids: string[], newUser: string): Promise<void> {
        const history = await EmailStorage.getEmails();
        const updated = history.map(e => {
            if (ids.includes(e.id)) {
                const shouldUpdateUser = !e.user || e.user === 'Unknown' || e.user === 'me';
                return { ...e, user: shouldUpdateUser ? newUser : e.user, ownerEmail: newUser, isOwned: true };
            }
            return e;
        });
        await EmailStorage.setEmails(updated);
    }

    static async deleteSyncedOnly(): Promise<void> {
        const history = await EmailStorage.getEmails();
        const unsynced = history.filter(e => !e.synced || !e.ownerEmail);
        await EmailStorage.setEmails(unsynced);
    }

    static async deleteAll(): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.remove(CONSTANTS.STORAGE_KEYS.LOCAL_HISTORY, resolve);
        });
    }

    static async deleteBySender(sender: string): Promise<void> {
        const history = await EmailStorage.getEmails();
        await EmailStorage.setEmails(history.filter(e => e.user !== sender));
    }

    static async deleteEmail(id: string): Promise<void> {
        const history = await EmailStorage.getEmails();
        await EmailStorage.setEmails(history.filter(e => e.id !== id));
    }

    // Identity (Local)
    static async getUserProfile(): Promise<{ id: string; email: string } | null> {
        return new Promise((resolve) => {
            chrome.storage.local.get([CONSTANTS.STORAGE_KEYS.USER_PROFILE], (res) => {
                const profile = res[CONSTANTS.STORAGE_KEYS.USER_PROFILE];
                resolve(profile ? (profile as { id: string; email: string }) : null);
            });
        });
    }

    static async setUserProfile(profile: { id: string; email: string } | null): Promise<void> {
        return new Promise((resolve) => {
            if (profile) {
                chrome.storage.local.set({ [CONSTANTS.STORAGE_KEYS.USER_PROFILE]: profile }, resolve);
            } else {
                chrome.storage.local.remove([CONSTANTS.STORAGE_KEYS.USER_PROFILE], resolve);
            }
        });
    }

    // Settings (Sync)
    static async getSettings(): Promise<ExtensionSettings> {
        return new Promise((resolve) => {
            chrome.storage.sync.get([
                CONSTANTS.STORAGE_KEYS.TRACKING_ENABLED,
                CONSTANTS.STORAGE_KEYS.BODY_PREVIEW_LENGTH,
                CONSTANTS.STORAGE_KEYS.THEME,
                CONSTANTS.STORAGE_KEYS.SHOW_TRACKING_INDICATOR,
                CONSTANTS.STORAGE_KEYS.CURRENT_USER
            ], (res) => resolve(res as ExtensionSettings));
        });
    }

    static async updateSettings(settings: ExtensionSettings): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.sync.set(settings, resolve);
        });
    }

    // Retries
    static async queuePendingDelete(ids: string[], user?: string) { return SyncQueue.queuePendingDelete(ids, user); }
    static async getPendingDeletes() { return SyncQueue.getPendingDeletes(); }
    static async clearPendingDeletes() { return SyncQueue.clearPendingDeletes(); }
}

