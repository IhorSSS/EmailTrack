import type { LocalEmailMetadata, TrackedEmail } from '../../types';
import { CONSTANTS } from '../../config/constants';

export class EmailStorage {
    static async getEmails(): Promise<LocalEmailMetadata[]> {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) return resolve([]);
                chrome.storage.local.get([CONSTANTS.STORAGE_KEYS.LOCAL_HISTORY], (result) => {
                    if (chrome.runtime.lastError) return resolve([]);
                    resolve((result[CONSTANTS.STORAGE_KEYS.LOCAL_HISTORY] || []) as LocalEmailMetadata[]);
                });
            } catch { resolve([]); }
        });
    }

    static async setEmails(emails: LocalEmailMetadata[]): Promise<void> {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [CONSTANTS.STORAGE_KEYS.LOCAL_HISTORY]: emails }, resolve);
        });
    }

    static async saveEmails(emailsToSave: TrackedEmail[]): Promise<void> {
        const local = await this.getEmails();
        const map = new Map(local.map(e => [e.id, e]));

        emailsToSave.forEach(email => {
            map.set(email.id, {
                id: email.id,
                recipient: email.recipient,
                cc: email.cc,
                bcc: email.bcc,
                subject: email.subject,
                body: email.body,
                user: email.user || '',
                ownerEmail: email.ownerEmail,
                createdAt: email.createdAt,
                synced: true,
                isOwned: !!email.ownerId,
                openCount: email.openCount ?? 0
            });
        });

        const updated = Array.from(map.values())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        await this.setEmails(updated);
    }

    static async saveEmail(email: LocalEmailMetadata): Promise<void> {
        const history = await this.getEmails();
        const existingIndex = history.findIndex(e => e.id === email.id);
        if (existingIndex >= 0) {
            history[existingIndex] = { ...history[existingIndex], ...email };
        } else {
            history.unshift({ ...email, synced: false });
        }
        await this.setEmails(history);
    }
}
