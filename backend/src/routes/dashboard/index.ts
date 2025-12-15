import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        const { page = 1, limit = 20, user } = request.query as { page?: any, limit?: any, user?: string };
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const whereClause = user ? { user: user } : {};

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
        const { user } = request.query as { user?: string };

        if (!user) {
            return reply.status(400).send({ error: 'User parameter is required' });
        }

        try {
            const result = await prisma.$transaction(async (tx) => {
                // 1. Find all emails for this user to get their IDs
                const userEmails = await tx.trackedEmail.findMany({
                    where: { user: user },
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
