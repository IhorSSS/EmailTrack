import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        const { page = 1, limit = 20 } = request.query as { page?: any, limit?: any };
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const [data, total] = await Promise.all([
            prisma.trackedEmail.findMany({
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: { opens: true }
                    }
                }
            }),
            prisma.trackedEmail.count()
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
