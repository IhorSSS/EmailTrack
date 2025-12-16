import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';
import { z } from 'zod';
import { authenticate, getAuthenticatedUser } from '../../middleware/authMiddleware';

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

        // AUTHENTICATION CHECK
        const authGoogleId = await getAuthenticatedUser(request);

        // Security: If ownerId is requested, it MUST match the authenticated user.
        if (ownerId) {
            if (!authGoogleId) {
                return reply.status(401).send({ error: 'Authentication required to access cloud data.' });
            }
            if (ownerId !== authGoogleId) {
                return reply.status(403).send({ error: 'Forbidden: You can only access your own data.' });
            }
        }

        const whereClause: any = {};
        let resolvedOwnerUuid: string | null = null;

        // Resolve Google ID to User UUID if permitted
        if (ownerId) { // We already verified ownerId === authGoogleId
            const userRecord = await prisma.user.findUnique({ where: { googleId: ownerId } });
            if (userRecord) {
                resolvedOwnerUuid = userRecord.id;
            } else {
                // Authenticated but user record missing? Strange, but safe to return empty.
                resolvedOwnerUuid = '00000000-0000-0000-0000-000000000000';
            }
        }

        if (resolvedOwnerUuid) {
            if (user) {
                // Filter specific sender within owner
                whereClause.ownerId = resolvedOwnerUuid;
                whereClause.user = user;
            } else {
                // ownerId only (handled in ids section if ids present, otherwise here)
                whereClause.ownerId = resolvedOwnerUuid;
            }
        } else if (user) {
            whereClause.user = user; // Legacy/Incognito strict filter
            // Enforce that we only return UNOWNED items if asking by 'user' (email) without 'ownerId'
            // effectively "Incognito View"
            whereClause.ownerId = null;
        }

        // Support ID list fetching for Incognito mode hydration (or fast cache sync)
        if (ids) {
            const idList = ids.split(',').filter(Boolean);
            if (idList.length > 0) {
                if (resolvedOwnerUuid) {
                    // Cloud mode: Return items owned by this account OR unowned items (if we want to allow claiming? No, just view)
                    // Actually, if I'm logged in, I should see my items.
                    // If I also have local items that are unowned, maybe I should see them too?
                    // Let's stick to: If ownerId is present, we are in Cloud Mode.

                    whereClause.id = { in: idList };
                    // Only show items I own. If I want to see unowned, I wouldn't pass ownerId.
                    whereClause.ownerId = resolvedOwnerUuid;

                    // Note: If the frontend wants to "merge" views, it handles it. 
                    // Backend strictness: ownerId param = strict ownership.
                } else {
                    // No ownerId param.
                    // STRICT: Only return items that are UNOWNED. (Incognito)
                    // This prevents Incognito users from snooping on valid IDs that strictly belong to someone else.
                    whereClause.id = { in: idList };
                    whereClause.ownerId = null;

                    // If 'user' was also provided, we already set whereClause.user = user AND ownerId = null above.
                    // This creates a safe intersection.
                }
            }
        } else {
            // No IDs provided.
            // If we are not in Cloud Mode (no ownerId), and assuming 'user' (email) is provided...
            if (!ownerId && !ids && !user) {
                // Warning: Dumping everything? No.
                return reply.status(400).send({ error: 'Query too broad. Specify user, ownerId, or ids.' });
            }
        }

        // Final Security Sanity Check
        if (!whereClause.ownerId && whereClause.ownerId !== null) {
            // Implicitly, if ownerId is not set in whereClause, it means we MIGHT be querying global?
            // But we have checks above.
            // if (user) -> OK.
            // if (ids) -> OK.
            // If neither -> 400 caught above.
            // Just ensure we default to unowned if explicit owner verification failed? 
            // We did that with `whereClause.ownerId = null` in the `user` block.
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

        // AUTHENTICATION REQUIRED FOR DELETE
        // Unless we are doing pure incognito deletion by ID (unowned only)
        const authGoogleId = await getAuthenticatedUser(request);

        if (ownerId) {
            if (!authGoogleId || ownerId !== authGoogleId) {
                return reply.status(403).send({ error: 'Forbidden' });
            }
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                let resolvedOwnerUuid: string | null = null;
                if (ownerId) { // Verified above
                    const u = await prisma.user.findUnique({ where: { googleId: ownerId } });
                    if (u) resolvedOwnerUuid = u.id;
                }

                if (ids) {
                    const idList = ids.split(',').filter(Boolean);
                    if (idList.length > 0) {
                        // Fetch existing emails to check ownership
                        const existingEmails = await tx.trackedEmail.findMany({
                            where: { id: { in: idList } },
                            select: { id: true, ownerId: true, user: true }
                        });

                        const unauthorized = existingEmails.filter(email => {
                            if (email.ownerId) {
                                // Owned item. Must match resolvedOwnerUuid
                                return email.ownerId !== resolvedOwnerUuid;
                            }
                            // Unowned item. Allow deletion if NO ownerId context (Incognito) 
                            // OR if ownerId context is provided (claiming/managing)? 
                            // Safe bet: Unowned items can be deleted by anyone who knows the ID? 
                            // Ideally, yes, for "Delete History" in incognito.
                            return false;
                        });

                        if (unauthorized.length > 0) {
                            return reply.status(403).send({ error: 'Forbidden: Cannot delete items you do not own.' });
                        }

                        const whereIdObj = { in: idList };
                        await tx.openEvent.deleteMany({ where: { trackedEmailId: whereIdObj } });
                        return await tx.trackedEmail.deleteMany({ where: { id: whereIdObj } });
                    }
                    return { count: 0 };
                }

                // BULK DELETION
                const conditions: any[] = [];

                if (resolvedOwnerUuid) {
                    // Delete all my cloud data
                    conditions.push({ ownerId: resolvedOwnerUuid });
                }

                if (user) {
                    // Delete by sender email
                    // If authed, delete MY data with this sender email
                    if (resolvedOwnerUuid) {
                        conditions.push({
                            ownerId: resolvedOwnerUuid,
                            user: user
                        });
                    } else {
                        // Not authed / Incognito
                        // Delete UNOWNED data with this sender email
                        conditions.push({
                            ownerId: null,
                            user: user
                        });
                    }
                }

                if (conditions.length === 0) {
                    return { count: 0 };
                }

                // If multiple conditions? (e.g. ownerId AND user)
                // We constructed it such that we probably want OR? or specific logic?
                // Logic above: 
                // if ownerId -> delete all mine. 
                // if ownerId + user -> delete all mine matching user?
                // The current array push implication is OR or AND?
                // Let's be precise.

                const deleteWhere: any = {};
                if (resolvedOwnerUuid) {
                    deleteWhere.ownerId = resolvedOwnerUuid;
                    if (user) deleteWhere.user = user;
                } else {
                    // Incognito
                    deleteWhere.ownerId = null;
                    if (user) deleteWhere.user = user;
                    else {
                        // Dangerous! Deleting all unowned?
                        // Schema validation requires user or ids if no ownerId?
                        // Check schema: user || ownerId || ids.
                        // So if only ownerId=null (implied) and no user/ids -> validation should fail?
                        // Schema says "at least one filter".
                        // If I passed nothing, it fails.
                        // If I pass user, I'm here.
                        // If I pass ONLY user: deleteWhere = { ownerId: null, user: user }. Safe.
                    }
                }

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

            reply.send({ success: true, count: result.count });
        } catch (e) {
            console.error('Failed to delete history:', e);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default dashboardRoutes;
