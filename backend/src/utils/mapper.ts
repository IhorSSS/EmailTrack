import { decrypt } from './crypto';

/**
 * Represents the encrypted fields present on a TrackedEmail record.
 * Used as an input contract for the mapper to ensure strict typing.
 */
interface EncryptedEmailFields {
    subject?: string | null;
    body?: string | null;
    recipient?: string | null;
    user?: string | null;
    cc?: string | null;
    bcc?: string | null;
}

/**
 * Mapper utility to process Prisma models and handle field decryption.
 * Centralizing this ensures consistent data transformation across Services.
 */
export class EmailMapper {
    /**
     * Decrypts all sensitive fields of a TrackedEmail model.
     * Uses a generic constraint to preserve the full shape of the input type,
     * while ensuring that the required encrypted fields are present.
     */
    static mapTrackedEmail<T extends EncryptedEmailFields>(item: T): T;
    static mapTrackedEmail<T extends EncryptedEmailFields>(item: T | null): T | null;
    static mapTrackedEmail<T extends EncryptedEmailFields>(item: T | null): T | null {
        if (!item) return null;

        return {
            ...item,
            subject: item.subject ? decrypt(item.subject) : item.subject,
            body: item.body ? decrypt(item.body) : item.body,
            recipient: item.recipient ? decrypt(item.recipient) : item.recipient,
            user: item.user ? decrypt(item.user) : item.user,
            cc: item.cc ? decrypt(item.cc) : item.cc,
            bcc: item.bcc ? decrypt(item.bcc) : item.bcc,
        };
    }
}
