import { prisma } from '../db';
import { encrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { UserService } from './UserService';
import { EmailData, GoogleAuthInfo } from '../types';
import crypto from 'crypto';

export class PMService {
    /**
     * Register or update a tracked email with security checks.
     * Handles encryption, ownership resolution, and hijack prevention.
     */
    static async registerEmail(data: EmailData, authInfo?: GoogleAuthInfo | null) {
        const { id, subject, recipient, cc, bcc, body, user, ownerId } = data;
        const targetId = id || crypto.randomUUID();


        // Resolve Verified User/Owner
        const authenticatedGoogleId = authInfo?.googleId || null;
        const primaryEmailFromAuth = authInfo?.email || null;

        const resolvedOwnerUuid = await UserService.resolveUserFromAuth(
            authenticatedGoogleId || ownerId || null,
            primaryEmailFromAuth || user || null
        );

        // SECURITY CHECK: If email exists and has an owner, verify requester ownership
        if (id) {
            const isHijack = await this.isEmailOwnedByAnother(id, resolvedOwnerUuid);
            if (isHijack) {
                logger.warn(`[PMService] Hijack attempt for email ${id} by user ${resolvedOwnerUuid || 'Anonymous'}`);
                throw new Error('FORBIDDEN_OWNERSHIP');
            }
        }

        return prisma.trackedEmail.upsert({
            where: { id: targetId },
            update: {
                subject: subject ? encrypt(subject) : subject,
                recipient: recipient ? encrypt(recipient) : recipient,
                cc: cc ? encrypt(cc) : cc,
                bcc: bcc ? encrypt(bcc) : bcc,
                body: body ? encrypt(body) : body,
                user: user ? encrypt(user) : user,
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
                ownerId: resolvedOwnerUuid
            }
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
            include: {
                opens: {
                    orderBy: { openedAt: 'desc' }
                }
            }
        });

        if (!email) return null;

        return {
            id: email.id,
            tracked: true,
            openCount: email.opens.length,
            opens: email.opens.map(open => ({
                openedAt: open.openedAt,
                device: open.device,
                location: open.location
            }))
        };
    }
}

