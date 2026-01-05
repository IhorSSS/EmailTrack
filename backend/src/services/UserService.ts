import { prisma } from '../db';
import { User } from '@prisma/client';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/crypto';

export class UserService {
    /**
     * Create or update a user (Master Account)
     */
    static async createOrUpdate(email: string, googleId: string): Promise<User> {
        return prisma.user.upsert({
            where: { googleId },
            update: { email },
            create: { email, googleId }
        });
    }

    /**
     * Find user by email
     */
    static async findByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email }
        });
    }

    /**
     * Find user by Google ID
     */
    static async findByGoogleId(googleId: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { googleId }
        });
    }

    /**
     * Find user by ID
     */
    static async findById(id: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id }
        });
    }

    /**
     * Link an existing anonymous email to a user account
     * (Future usage for migration)
     */
    static async linkEmailToUser(emailId: string, userId: string) {
        return prisma.trackedEmail.update({
            where: { id: emailId },
            data: { ownerId: userId }
        });
    }

    /**
     * Batch link anonymous emails to a user account and update metadata
     */
    /**
     * Batch link anonymous emails to a user account and update metadata.
     * STRICTLY PREVENTS taking ownership of emails already owned by another user.
     */
    static async batchLinkEmails(userId: string, emails: { id: string, subject?: string, recipient?: string, body?: string, user?: string }[]) {
        if (emails.length === 0) return [];

        const emailIds = emails.map(e => e.id);

        // 1. Security Check: Ensure we are not overwriting someone else's emails
        // Ideally the Frontend checks this via /check-conflicts, but Backend must be the final gatekeeper.
        const conflicts = await prisma.trackedEmail.findMany({
            where: {
                id: { in: emailIds },
                ownerId: { not: null }, // Already owned
                NOT: { ownerId: userId } // By someone else
            },
            select: { id: true, ownerId: true }
        });

        if (conflicts.length > 0) {
            logger.warn(`[Security] User ${userId} attempted to claim owned emails: ${conflicts.map(c => c.id).join(', ')}`);
            throw new Error(`Ownership Conflict: ${conflicts.length} emails already belong to another user.`);
        }

        // 2. Safe to Upsert
        return prisma.$transaction(
            emails.map(email =>
                prisma.trackedEmail.upsert({
                    where: { id: email.id },
                    create: {
                        id: email.id,
                        ownerId: userId,
                        subject: email.subject ? encrypt(email.subject) : 'Unknown',
                        recipient: email.recipient ? encrypt(email.recipient) : 'Unknown',
                        cc: (email as any).cc ? encrypt((email as any).cc) : (email as any).cc,
                        bcc: (email as any).bcc ? encrypt((email as any).bcc) : (email as any).bcc,
                        body: email.body ? encrypt(email.body) : email.body,
                        user: email.user ? encrypt(email.user) : 'Unknown' // Save Sender Identity
                    },
                    update: {
                        ownerId: userId,
                        subject: email.subject ? encrypt(email.subject) : email.subject,
                        recipient: email.recipient ? encrypt(email.recipient) : email.recipient,
                        cc: (email as any).cc ? encrypt((email as any).cc) : (email as any).cc,
                        bcc: (email as any).bcc ? encrypt((email as any).bcc) : (email as any).bcc,
                        body: email.body ? encrypt(email.body) : email.body,
                        user: email.user ? encrypt(email.user) : email.user // Update Sender Identity
                    }
                })
            )
        );
    }
    /**
     * Check if any of the provided email IDs are owned by a different user.
     * Returns true if there is a conflict.
     */
    static async hasOwnershipConflict(emailIds: string[], intendedOwnerGoogleId: string): Promise<boolean> {
        if (emailIds.length === 0) return false;

        // Find existing emails provided in the list that are already owned
        const existing = await prisma.trackedEmail.findMany({
            where: {
                id: { in: emailIds },
                ownerId: { not: null }
            },
            include: { owner: true }
        });

        if (existing.length === 0) return false;

        // Check if any owner is different from intended
        for (const email of existing) {
            // If the email has an owner, and that owner's Google ID is different from the one trying to sync
            if (email.owner && email.owner.googleId !== intendedOwnerGoogleId) {
                return true; // Conflict found! Owned by someone else.
            }
        }

        return false;
    }
}
