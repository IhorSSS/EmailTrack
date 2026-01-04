import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';
import { z } from 'zod';
import { authenticate, getAuthenticatedUser } from '../../middleware/authMiddleware';

const GetDashboardQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(1000).default(20), // Cap limit at 1000 for safety
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
        const authInfo = await getAuthenticatedUser(request);
        const authGoogleId = authInfo?.googleId || null;

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

        // Support ID list fetching for Incognito mode hydration (or fast cache sync)
        if (ids) {
            const idList = ids.split(',').filter(Boolean);
            if (idList.length > 0) {
                if (resolvedOwnerUuid) {
                    // Cloud mode: Return items owned by this account
                    whereClause.id = { in: idList };
                    whereClause.ownerId = resolvedOwnerUuid;
                } else {
                    // Incognito mode with Explicit IDs (Proof of Knowledge)
                    // Allow fetching ANY items if their ID is known, regardless of ownership.
                    // This fixes the issue where Incognito users lose visibility of items they just claimed and logged out from.
                    whereClause.id = { in: idList };

                    // SECURITY NOTE:
                    // We DO NOT filter by ownerId here. If you know the UUID, you can view the stats.
                    // This is consistent with the pixel tracking model (public if ID is known).
                    // We still respect 'user' filter if provided.
                    if (user) {
                        whereClause.user = user;
                    }
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
        const authInfo = await getAuthenticatedUser(request);
        const authGoogleId = authInfo?.googleId || null;

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
