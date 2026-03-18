import { prisma } from '../db';
import { User } from '@prisma/client';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/crypto';

export interface IncomingEmail {
    id: string;
    subject?: string;
    recipient?: string;
    body?: string;
    user?: string;
    cc?: string;
    bcc?: string;
}

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
     * Batch link anonymous emails to a user account and update metadata.
     * STRICTLY PREVENTS taking ownership of emails already owned by another user.
     */
    static async batchLinkEmails(userId: string, emails: IncomingEmail[]) {
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
                        cc: email.cc ? encrypt(email.cc) : null,
                        bcc: email.bcc ? encrypt(email.bcc) : null,
                        body: email.body ? encrypt(email.body) : null,
                        user: email.user ? encrypt(email.user) : 'Unknown' // Save Sender Identity
                    },
                    update: {
                        ownerId: userId,
                        subject: email.subject ? encrypt(email.subject) : email.subject,
                        recipient: email.recipient ? encrypt(email.recipient) : email.recipient,
                        cc: email.cc ? encrypt(email.cc) : null,
                        bcc: email.bcc ? encrypt(email.bcc) : null,
                        body: email.body ? encrypt(email.body) : null,
                        user: email.user ? encrypt(email.user) : email.user // Update Sender Identity
                    }
                })
            )
        );
    }

    /**
     * Resolve user UUID from Google ID and/or Primary Email.
     * Handles existing user lookup, merging googleId with existing by email, or creating new.
     */
    static async resolveUserFromAuth(googleId: string | null, primaryEmail: string | null): Promise<string | null> {
        if (!googleId && !primaryEmail) return null;

        try {
            let dbUser = null;

            // 1. Try to find by Google ID
            if (googleId) {
                dbUser = await prisma.user.findUnique({ where: { googleId } });
            }

            // 2. If not found by Google ID, try to find by Email
            if (!dbUser && primaryEmail) {
                dbUser = await prisma.user.findUnique({ where: { email: primaryEmail } });

                // If found by email but has no googleId, link it
                if (dbUser && googleId && !dbUser.googleId) {
                    dbUser = await prisma.user.update({
                        where: { id: dbUser.id },
                        data: { googleId }
                    });
                    logger.info(`[USER] Linked existing user ${primaryEmail} with Google ID ${googleId}`);
                }
            }

            // 3. If still not found, create new user
            if (!dbUser && primaryEmail && googleId) {
                dbUser = await prisma.user.create({
                    data: {
                        email: primaryEmail,
                        googleId: googleId
                    }
                });
                logger.info(`[USER] Created new user ${primaryEmail} for Google ID ${googleId}`);
            }

            return dbUser ? dbUser.id : null;
        } catch (err) {
            logger.error('[USER] User resolution failed completely:', err);
            return null;
        }
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
