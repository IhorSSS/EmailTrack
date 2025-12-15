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
};

export default dashboardRoutes;
