import { prisma } from '../db';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { UserService } from './UserService';
import { EmailData, GoogleAuthInfo } from '../types';
import { EmailMapper } from '../utils/mapper';
import crypto from 'crypto';

export class PMService {
    /**
     * Register or update a tracked email with security checks.
     * Handles encryption, ownership resolution, and hijack prevention.
     */
    static async registerEmail(data: EmailData, authInfo?: GoogleAuthInfo | null) {
        const { id, subject, recipient, cc, bcc, body, user, threadId, ownerId } = data;
        const targetId = id || crypto.randomUUID();


        // Resolve Verified User/Owner
        const authenticatedGoogleId = authInfo?.googleId || null;
        const primaryEmailFromAuth = authInfo?.email || null;

        const resolvedOwnerUuid = await UserService.resolveUserFromAuth(
            authenticatedGoogleId || ownerId || null,
            primaryEmailFromAuth || user || null
        );

        return prisma.$transaction(async (tx) => {
            // SECURITY CHECK: If email exists and has an owner, verify requester ownership
            if (id) {
                const existingEmail = await tx.trackedEmail.findUnique({
                    where: { id },
                    select: { ownerId: true }
                });

                if (existingEmail && existingEmail.ownerId && existingEmail.ownerId !== resolvedOwnerUuid) {
                    logger.warn(`[PMService] Hijack attempt for email ${id} by user ${resolvedOwnerUuid || 'Anonymous'}`);
                    throw new Error('FORBIDDEN_OWNERSHIP');
                }
            }

            return tx.trackedEmail.upsert({
                where: { id: targetId },
                update: {
                    subject: subject ? encrypt(subject) : subject,
                    recipient: recipient ? encrypt(recipient) : recipient,
                    cc: cc ? encrypt(cc) : cc,
                    bcc: bcc ? encrypt(bcc) : bcc,
                    body: body ? encrypt(body) : body,
                    user: user ? encrypt(user) : user,
                    threadId: threadId || null,
                    ownerId: resolvedOwnerUuid
                },
                create: {
                    id: targetId,
                    subject: subject ? encrypt(subject) : subject,
                    recipient: recipient ? encrypt(recipient) : recipient,
                    cc: cc ? encrypt(cc) : cc,
                    bcc: bcc ? encrypt(bcc) : bcc,
                    body: body ? encrypt(body) : body,
                    user: user ? encrypt(user) : user,
                    threadId: threadId || null,
                    ownerId: resolvedOwnerUuid
                }
            });
        });
    }


    /**
     * Verify if an email is owned by a specific user.
     * Returns true if the email exists and is owned by someone else.
     */
    static async isEmailOwnedByAnother(id: string, requesterUuid: string | null): Promise<boolean> {
        const existingEmail = await prisma.trackedEmail.findUnique({
            where: { id },
            select: { ownerId: true }
        });

        if (existingEmail && existingEmail.ownerId && existingEmail.ownerId !== requesterUuid) {
            return true;
        }
        return false;
    }

    /**
     * Get anonymized stats for a specific email.
     */
    static async getEmailStats(id: string) {
        const email = await prisma.trackedEmail.findUnique({
            where: { id },
            select: {
                id: true,
                subject: true,
                recipient: true,
                body: true,
                user: true,
                cc: true,
                bcc: true,
                threadId: true,
                ownerId: true,
                createdAt: true,
                opens: {
                    orderBy: { openedAt: 'desc' }
                }
            }
        });

        if (!email) return null;

        return {
            ...EmailMapper.mapTrackedEmail(email),
            tracked: true,
            threadId: email.threadId,
            openCount: email.opens.length,
            lastOpened: email.opens.length > 0 ? email.opens[0].openedAt : null,
            opens: email.opens
        };
    }
}
