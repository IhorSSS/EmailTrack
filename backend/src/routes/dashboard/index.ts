import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';
import { z } from 'zod';

const GetDashboardQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20), // Cap limit at 100 for safety
    user: z.string().optional(),
    ownerId: z.string().optional(),
    ids: z.string().optional()
});

const DeleteDashboardQuerySchema = z.object({
    user: z.string().optional(),
    ownerId: z.string().optional(),
    ids: z.string().optional()
}).refine(data => data.user || data.ownerId || data.ids, {
    message: "At least one filter (user, ownerId, or ids) is required"
});

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        let query;
        try {
            query = GetDashboardQuerySchema.parse(request.query);
        } catch (e) {
            return reply.status(400).send({ error: 'Invalid query parameters' });
        }

        const { page, limit, user, ownerId, ids } = query;
        const skip = (page - 1) * limit;
        const take = limit;

        const whereClause: any = {};

        // CORRECTION: 'ownerId' from query is Google ID. DB expects UUID.
        let resolvedOwnerUuid: string | null = null;
        if (ownerId) {
            const userRecord = await prisma.user.findUnique({ where: { googleId: ownerId } });
            console.log(`[DASHBOARD] Resolving ownerId (GoogleID) ${ownerId} -> User found: ${!!userRecord}, UUID: ${userRecord?.id}`);
            if (userRecord) {
                resolvedOwnerUuid = userRecord.id;
            } else {
                // If user doesn't exist for this Google ID, they effectively own nothing.
                // We should probably return empty, or handle gracefully.
                // For now, let's set a dummy UUID to ensure empty result rather than null (all).
                resolvedOwnerUuid = '00000000-0000-0000-0000-000000000000';
            }
        }

        if (resolvedOwnerUuid) {
            if (user) {
                // Filter specific sender within owner
                whereClause.ownerId = resolvedOwnerUuid;
                whereClause.user = user;
            } else {
                // ownerId only (handled in ids section if ids present)
                whereClause.ownerId = resolvedOwnerUuid;
            }
        } else if (user) {
            whereClause.user = user; // Legacy/Incognito strict filter
        }

        console.log('[DASHBOARD] ID Filtering:', { ids, resolvedOwnerUuid, whereClause });

        // Support ID list fetching for Incognito mode hydration
        if (ids) {
            const idList = ids.split(',');
            if (idList.length > 0) {
                // SECURITY: When fetching by IDs, verify ownership
                // If ownerId provided, ensure IDs belong to that owner
                // If user provided, ensure IDs belong to that sender
                // If neither, only return unowned (incognito) items

                if (resolvedOwnerUuid) {
                    // Cloud mode: Return only items owned by this account OR unowned items
                    // Clear previous whereClause and use OR logic
                    whereClause.id = { in: idList };
                    whereClause.OR = [
                        { ownerId: resolvedOwnerUuid },
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
        let query;
        try {
            query = DeleteDashboardQuerySchema.parse(request.query);
        } catch (e) {
            return reply.status(400).send({ error: 'At least one filter (user, ownerId, or ids) is required' });
        }
        const { user, ownerId, ids } = query;

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
                        // CORRECTION: Resolve Google ID to UUID for ownership verification
                        let verifyOwnerUuid: string | null = null;
                        if (ownerId) {
                            const u = await prisma.user.findUnique({ where: { googleId: ownerId } });
                            if (u) verifyOwnerUuid = u.id;
                        }

                        if (verifyOwnerUuid || user) {
                            const unauthorized = existingEmails.filter(email => {
                                // If email is owned, verify it matches requester
                                if (email.ownerId) {
                                    return email.ownerId !== verifyOwnerUuid;
                                }
                                // If email has user field, verify it matches
                                if (email.user && user) {
                                    return email.user !== user;
                                }
                                return false; // Unowned items are OK
                            });

                            if (unauthorized.length > 0) {
                                // SECURITY: Don't reveal which specific IDs are unauthorized
                                return reply.status(403).send({ error: 'Forbidden' });
                            }
                        } else {
                            // No ownerId/user provided - only allow deletion of unowned items
                            const ownedItems = existingEmails.filter(e => e.ownerId !== null);
                            if (ownedItems.length > 0) {
                                return reply.status(403).send({ error: 'Forbidden' });
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

                // --- Fallback: Broad Deletion (Account Wipe or Sender Wipe) ---

                // CORRECTION: Resolve Google ID to UUID for deletion too
                let deleteOwnerUuid: string | null = null;
                if (ownerId) {
                    const u = await prisma.user.findUnique({ where: { googleId: ownerId } });
                    if (u) deleteOwnerUuid = u.id;
                }

                // Construct OR clause to catch both Cloud (ownerId) and Legacy/Ghost (user email) records
                const conditions: any[] = [];
                if (deleteOwnerUuid) conditions.push({ ownerId: deleteOwnerUuid });
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
