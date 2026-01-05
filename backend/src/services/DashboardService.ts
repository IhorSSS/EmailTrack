import { prisma } from '../db';
import { decrypt } from '../utils/crypto';


export interface DashboardFilter {
    page: number;
    limit: number;
    user?: string;
    ownerId?: string | null;
    ids?: string[];
    // Resolved owner UUID after auth check
    resolvedOwnerUuid?: string | null;
}

export interface DeleteFilter {
    user?: string;
    ownerId?: string;
    ids?: string[]; // CSV string from query, parsed before calling service
    resolvedOwnerUuid?: string | null;
}

export class DashboardService {
    static async getDashboardData(filter: DashboardFilter) {
        const { page, limit, user, ids, resolvedOwnerUuid } = filter;
        const skip = (page - 1) * limit;
        const take = limit;

        const whereClause: any = {};

        if (resolvedOwnerUuid) {
            if (user) {
                whereClause.ownerId = resolvedOwnerUuid;
                whereClause.user = user;
            } else {
                whereClause.ownerId = resolvedOwnerUuid;
            }
        } else if (user && !ids) {
            // Only enforce 'ownerId = null' (Unowned) if we are listing by USER (broad query).
            // If querying by IDs (specific), we allow owned items (handled below).
            whereClause.user = user;
            whereClause.ownerId = null;
        }

        // Support ID list fetching
        if (ids && ids.length > 0) {
            if (resolvedOwnerUuid) {
                // Cloud mode: Return items owned by this account
                whereClause.id = { in: ids };
                whereClause.ownerId = resolvedOwnerUuid;
            } else {
                // Incognito mode with Explicit IDs
                whereClause.id = { in: ids };

                // SECURITY NOTE:
                // We DO NOT filter by ownerId here. If you know the UUID, you can view the stats.
                if (user) {
                    whereClause.user = user;
                }
            }
        }

        const isAnonymous = !resolvedOwnerUuid;

        const queryOptions: any = {
            where: whereClause,
            skip,
            take,
            orderBy: { createdAt: 'desc' }
        };

        if (isAnonymous) {
            queryOptions.select = {
                id: true,
                ownerId: true,
                createdAt: true,
                opens: {
                    orderBy: { openedAt: 'desc' as const },
                    select: {
                        openedAt: true,
                        location: true,
                        device: true
                    }
                },
                _count: {
                    select: { opens: true }
                }
            };
        } else {
            // Authenticated: Return full object (include relations)
            queryOptions.include = {
                opens: {
                    orderBy: { openedAt: 'desc' as const }
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
            data: data.map(item => {
                const decrypted: any = { ...item };
                if (decrypted.subject) decrypted.subject = decrypt(decrypted.subject);
                if (decrypted.body) decrypted.body = decrypt(decrypted.body);
                if (decrypted.recipient) decrypted.recipient = decrypt(decrypted.recipient);
                if (decrypted.user) decrypted.user = decrypt(decrypted.user);
                if (decrypted.cc) decrypted.cc = decrypt(decrypted.cc);
                if (decrypted.bcc) decrypted.bcc = decrypt(decrypted.bcc);
                return decrypted;
            }),
            total,
            page,
            limit
        };

    }

    static async deleteDashboardData(filter: DeleteFilter) {
        const { user, ids, resolvedOwnerUuid } = filter;

        return await prisma.$transaction(async (tx) => {
            if (ids && ids.length > 0) {
                // Fetch existing emails to check ownership
                const existingEmails = await tx.trackedEmail.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, ownerId: true, user: true }
                });

                const unauthorized = existingEmails.filter(email => {
                    if (email.ownerId) {
                        // Owned item. Must match resolvedOwnerUuid
                        return email.ownerId !== resolvedOwnerUuid;
                    }
                    return false;
                });

                if (unauthorized.length > 0) {
                    throw new Error('FORBIDDEN_OWNERSHIP');
                }

                const whereIdObj = { in: ids };
                await tx.openEvent.deleteMany({ where: { trackedEmailId: whereIdObj } });
                return await tx.trackedEmail.deleteMany({ where: { id: whereIdObj } });
            }

            // BULK DELETION
            const conditions: any[] = [];

            if (resolvedOwnerUuid) {
                // Delete all my cloud data
                // Logic: ownerId = me
                const condition: any = { ownerId: resolvedOwnerUuid };
                if (user) condition.user = user;
                conditions.push(condition);
            } else if (user) {
                // Not authed / Incognito
                // Delete UNOWNED data with this sender email
                conditions.push({
                    ownerId: null,
                    user: user
                });
            }

            if (conditions.length === 0) {
                return { count: 0 };
            }

            // We only support one bulk condition path really based on auth state
            const deleteWhere = conditions[0];

            // 1. Find IDs
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
        const data = await prisma.trackedEmail.findMany({
            where: {
                id: { in: ids }
            },
            select: {
                id: true,
                ownerId: true,
                createdAt: true,
                opens: {
                    orderBy: { openedAt: 'desc' },
                    select: {
                        openedAt: true,
                        location: true,
                        device: true
                    }
                },
                _count: {
                    select: { opens: true }
                }
            }
        });

        return data.map(item => {
            const decrypted: any = { ...item };
            if (decrypted.recipient) decrypted.recipient = decrypt(decrypted.recipient);
            if (decrypted.user) decrypted.user = decrypt(decrypted.user);
            if (decrypted.cc) decrypted.cc = decrypt(decrypted.cc);
            if (decrypted.bcc) decrypted.bcc = decrypt(decrypted.bcc);
            return decrypted;
        });
    }
}
