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
            whereClause.ownerId = ownerId;
            if (user) whereClause.user = user; // Filter specific sender within owner
        } else if (user) {
            whereClause.user = user; // Legacy/Incognito strict filter
        }

        // Support ID list fetching for Incognito mode hydration
        if (ids) {
            const idList = ids.split(',');
            if (idList.length > 0) {
                // If ids are provided, we generally ignore ownerId/user strictness OR combine them?
                // For Incognito hydration, we just want these specific IDs.
                // But for security, we might want to ensure they match user? 
                // In Incognito, user is null in DB, but matches local storage list.
                // Simple approach: ID matches.
                whereClause.id = { in: idList };
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
        const { user, ownerId } = request.query as { user?: string, ownerId?: string };

        if (!user && !ownerId) {
            return reply.status(400).send({ error: 'User or ownerId parameter is required' });
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                const whereClause: any = {};
                if (ownerId) whereClause.ownerId = ownerId;
                else if (user) whereClause.user = user;

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
