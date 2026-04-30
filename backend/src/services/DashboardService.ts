import { prisma } from '../db';
import { decrypt } from '../utils/crypto';
import { Prisma } from '@prisma/client';
import { UserService } from './UserService';
import { DashboardFilter, DeleteFilter, GoogleAuthInfo } from '../types';

export class DashboardService {
    /**
     * Fetch dashboard data with security and ownership resolution.
     */
    static async getDashboardData(filter: DashboardFilter, authInfo?: GoogleAuthInfo | null) {
        const { page, limit, user, ids, ownerId, since } = filter;
        const skip = (page - 1) * limit;
        const take = limit;

        const authGoogleId = authInfo?.googleId || null;

        // Security: If ownerId is requested, it MUST match the authenticated user.
        if (ownerId && (!authGoogleId || ownerId !== authGoogleId)) {
            throw new Error('FORBIDDEN_ACCESS');
        }

        let resolvedOwnerUuid: string | null = null;
        if (ownerId) {
            const userRecord = await prisma.user.findUnique({ where: { googleId: ownerId } });
            resolvedOwnerUuid = userRecord ? userRecord.id : '00000000-0000-0000-0000-000000000000';
        }

        const whereClause: Prisma.TrackedEmailWhereInput = {};

        if (resolvedOwnerUuid) {
            whereClause.ownerId = resolvedOwnerUuid;
            if (user) whereClause.user = user;
        } else if (user && !ids) {
            whereClause.user = user;
            whereClause.ownerId = null;
        }

        if (ids && ids.length > 0) {
            whereClause.id = { in: ids };
            if (resolvedOwnerUuid) {
                whereClause.ownerId = resolvedOwnerUuid;
            } else if (user) {
                whereClause.user = user;
            }
        }

        if (since) {
            const isNumeric = /^\d+$/.test(since);
            const sinceDate = new Date(isNumeric ? parseInt(since, 10) : since);
            
            if (!isNaN(sinceDate.getTime())) {
                whereClause.updatedAt = { gte: sinceDate };
            }
        }

        const isAnonymous = !resolvedOwnerUuid;

        const queryOptions: Prisma.TrackedEmailFindManyArgs = {
            where: whereClause,
            skip,
            take,
            orderBy: since ? { updatedAt: 'asc' } : { updatedAt: 'desc' }
        };

        if (isAnonymous) {
            queryOptions.select = {
                id: true,
                ownerId: true,
                createdAt: true,
                opens: {
                    orderBy: { openedAt: 'desc' },
                    take: 50,
                    select: {
                        id: true,
                        openedAt: true,
                        location: true,
                        device: true,
                        ip: true
                    }
                },
                _count: {
                    select: { opens: true }
                }
            };
        } else {
            queryOptions.include = {
                opens: {
                    orderBy: { openedAt: 'desc' },
                    take: 50
                },
                _count: {
                    select: { opens: true }
                }
            };
        }

        const [data, total] = await Promise.all([
            prisma.trackedEmail.findMany(queryOptions),
            prisma.trackedEmail.count({ where: whereClause })
        ]);

        return {
            data: data.map(item => ({
                ...item,
                subject: item.subject ? decrypt(item.subject) : item.subject,
                body: item.body ? decrypt(item.body) : item.body,
                recipient: item.recipient ? decrypt(item.recipient) : item.recipient,
                user: item.user ? decrypt(item.user) : item.user,
                cc: item.cc ? decrypt(item.cc) : item.cc,
                bcc: item.bcc ? decrypt(item.bcc) : item.bcc,
            })),
            total,
            page,
            limit,
            meta: { serverTime: Date.now() }
        };
    }

    /**
     * Delete dashboard data with security and ownership resolution.
     */
    static async deleteDashboardData(filter: DeleteFilter, authInfo?: GoogleAuthInfo | null) {
        const { user, ids, ownerId } = filter;
        const authGoogleId = authInfo?.googleId || null;

        if (ownerId && (!authGoogleId || ownerId !== authGoogleId)) {
            throw new Error('FORBIDDEN_ACCESS');
        }

        let resolvedOwnerUuid: string | null = null;
        if (ownerId) {
            const u = await prisma.user.findUnique({ where: { googleId: ownerId } });
            if (u) resolvedOwnerUuid = u.id;
        }

        return await prisma.$transaction(async (tx) => {
            if (ids && ids.length > 0) {
                const existingEmails = await tx.trackedEmail.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, ownerId: true, user: true }
                });


                const unauthorized = existingEmails.filter(email => 
                    email.ownerId && email.ownerId !== resolvedOwnerUuid
                );

                if (unauthorized.length > 0) {
                    throw new Error('FORBIDDEN_OWNERSHIP');
                }

                const whereIdObj = { in: ids };
                await tx.openEvent.deleteMany({ where: { trackedEmailId: whereIdObj } });
                return await tx.trackedEmail.deleteMany({ where: { id: whereIdObj } });
            }

            const conditions: Prisma.TrackedEmailWhereInput[] = [];
            if (resolvedOwnerUuid) {
                const condition: Prisma.TrackedEmailWhereInput = { ownerId: resolvedOwnerUuid };
                if (user) condition.user = user;
                conditions.push(condition);
            } else if (user) {
                conditions.push({ ownerId: null, user: user });
            }

            if (conditions.length === 0) return { count: 0 };

            const deleteWhere = conditions[0];
            const targets = await tx.trackedEmail.findMany({
                where: deleteWhere,
                select: { id: true }
            });

            if (targets.length === 0) return { count: 0 };
            const targetIds = targets.map(t => t.id);

            await tx.openEvent.deleteMany({ where: { trackedEmailId: { in: targetIds } } });
            return await tx.trackedEmail.deleteMany({ where: { id: { in: targetIds } } });
        });
    }

    static async syncDashboardData(ids: string[]) {
        return prisma.trackedEmail.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                ownerId: true,
                createdAt: true,
                opens: {
                    orderBy: { openedAt: 'desc' },
                    take: 50,
                    select: {
                        id: true,
                        openedAt: true,
                        location: true,
                        device: true,
                        ip: true
                    }
                },
                _count: {
                    select: { opens: true }
                }
            }
        });
    }

    static async getEmailOpens(emailId: string, skip: number, take: number, authInfo: GoogleAuthInfo | null, sort: 'asc' | 'desc' = 'desc') {
        // Find the email and its owner to check ownership securely
        const email = await prisma.trackedEmail.findUnique({
            where: { id: emailId },
            select: { ownerId: true, owner: { select: { googleId: true } } }
        });

        if (!email) {
            throw new Error('NOT_FOUND');
        }

        // If email has an owner, verify the authenticated user matches the owner's Google ID
        if (email.ownerId && (!authInfo || authInfo.googleId !== email.owner?.googleId)) {
            throw new Error('FORBIDDEN_ACCESS');
        }

        const [data, total] = await Promise.all([
            prisma.openEvent.findMany({
                where: { trackedEmailId: emailId },
                orderBy: { openedAt: sort },
                skip,
                take,
                select: {
                    id: true,
                    openedAt: true,
                    location: true,
                    device: true,
                    ip: true
                }
            }),
            prisma.openEvent.count({
                where: { trackedEmailId: emailId }
            })
        ]);

        return { data, total };
    }
}

