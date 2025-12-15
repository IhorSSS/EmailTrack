import { prisma } from '../db';
import { User } from '@prisma/client';

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
    static async batchLinkEmails(userId: string, emails: { id: string, subject?: string, recipient?: string, body?: string }[]) {
        // Use upsert to handle cases where email might be missing on server but exists locally
        return prisma.$transaction(
            emails.map(email =>
                prisma.trackedEmail.upsert({
                    where: { id: email.id },
                    create: {
                        id: email.id,
                        ownerId: userId,
                        subject: email.subject || 'Unknown',
                        recipient: email.recipient || 'Unknown',
                        body: email.body,
                        user: 'Unknown' // Placeholder, will be linked to ownerId
                    },
                    update: {
                        ownerId: userId,
                        subject: email.subject,
                        recipient: email.recipient,
                        body: email.body
                    }
                })
            )
        );
    }
}
