import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        const { page = 1, limit = 20, user, ownerId, ids } = request.query as {
            page?: any,
            limit?: any,
            user?: string,
            ownerId?: string,
            ids?: string
        };
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const whereClause: any = {};
        if (ownerId) {
            if (user) {
                // Filter specific sender within owner
                whereClause.ownerId = ownerId;
                whereClause.user = user;
            } else {
                // ownerId only (handled in ids section if ids present)
                whereClause.ownerId = ownerId;
            }
        } else if (user) {
            whereClause.user = user; // Legacy/Incognito strict filter
        }

        // Support ID list fetching for Incognito mode hydration
        if (ids) {
            const idList = ids.split(',');
            if (idList.length > 0) {
                // SECURITY: When fetching by IDs, verify ownership
                // If ownerId provided, ensure IDs belong to that owner
                // If user provided, ensure IDs belong to that sender
                // If neither, only return unowned (incognito) items

                if (ownerId) {
                    // Cloud mode: Return only items owned by this account OR unowned items
                    // Clear previous whereClause and use OR logic
                    whereClause.id = { in: idList };
                    whereClause.OR = [
                        { ownerId: ownerId },
                        { ownerId: null }
                    ];
                    // Remove individual ownerId to avoid conflict with OR
                    delete whereClause.ownerId;
                } else if (user) {
                    // Incognito with user filter: Return items for this sender
                    whereClause.id = { in: idList };
                    whereClause.user = user;
                } else {
                    // No auth provided: Only return unowned items
                    whereClause.id = { in: idList };
                    whereClause.ownerId = null;
                }
            }
        }

        const [data, total] = await Promise.all([
            prisma.trackedEmail.findMany({
                where: whereClause,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    opens: {
                        orderBy: { openedAt: 'desc' }
                    },
                    _count: {
                        select: { opens: true }
                    }
                }
            }),
            prisma.trackedEmail.count({ where: whereClause })
        ]);

        reply.send({
            data,
            total,
            page: Number(page),
            limit: Number(limit)
        });
    });

    fastify.delete('/', async (request, reply) => {
        const { user, ownerId, ids } = request.query as { user?: string, ownerId?: string, ids?: string };

        if (!user && !ownerId && !ids) {
            return reply.status(400).send({ error: 'User, ownerId or ids parameter is required' });
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                // If specific IDs are provided, prioritized them (Incognito logic primarily)
                if (ids) {
                    const idList = ids.split(',').filter(Boolean);
                    if (idList.length > 0) {
                        // SECURITY: Verify ownership before deletion
                        // Fetch existing emails to check ownership
                        const existingEmails = await tx.trackedEmail.findMany({
                            where: { id: { in: idList } },
                            select: { id: true, ownerId: true, user: true }
                        });

                        // IMPORTANT: For Incognito mode (ownerId=null), we allow deletion
                        // These are local-only pixels that haven't been claimed by any account
                        // For owned items, we need to verify they match the requester

                        // If ownerId or user is provided with ids, verify all items match
                        if (ownerId || user) {
                            const unauthorized = existingEmails.filter(email => {
                                // If email is owned, verify it matches requester
                                if (email.ownerId) {
                                    return email.ownerId !== ownerId;
                                }
                                // If email has user field, verify it matches
                                if (email.user && user) {
                                    return email.user !== user;
                                }
                                return false; // Unowned items are OK
                            });

                            if (unauthorized.length > 0) {
                                throw new Error('Unauthorized: Cannot delete items belonging to another user');
                            }
                        } else {
                            // No ownerId/user provided - only allow deletion of unowned items
                            const ownedItems = existingEmails.filter(e => e.ownerId !== null);
                            if (ownedItems.length > 0) {
                                throw new Error('Unauthorized: Cannot delete owned items without authentication');
                            }
                        }

                        const whereIdObj = { in: idList };

                        // 1. Delete events
                        await tx.openEvent.deleteMany({
                            where: { trackedEmailId: whereIdObj }
                        });

                        // 2. Delete emails
                        return await tx.trackedEmail.deleteMany({
                            where: { id: whereIdObj }
                        });
                    }
                    return { count: 0 };
                }

                // --- Fallback: Broad Deletion (Account Wipe or Sender Wipe) ---

                // Construct OR clause to catch both Cloud (ownerId) and Legacy/Ghost (user email) records
                const conditions: any[] = [];
                if (ownerId) conditions.push({ ownerId });
                if (user) conditions.push({ user });

                const whereClause = {
                    OR: conditions
                };

                // 1. Find all emails for this user to get their IDs
                const userEmails = await tx.trackedEmail.findMany({
                    where: whereClause,
                    select: { id: true }
                });

                if (userEmails.length === 0) {
                    return { count: 0 };
                }

                const emailIds = userEmails.map(e => e.id);

                // 2. Explicitly delete all open events for these specific Email IDs
                await tx.openEvent.deleteMany({
                    where: {
                        trackedEmailId: {
                            in: emailIds
                        }
                    }
                });

                // 3. Now it is safe to delete the emails themselves
                return await tx.trackedEmail.deleteMany({
                    where: {
                        id: {
                            in: emailIds
                        }
                    }
                });
            });

            reply.send({ success: true, count: result.count });
        } catch (e) {
            console.error('Failed to delete history:', e);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default dashboardRoutes;
