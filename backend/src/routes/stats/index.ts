import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';

const statsRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        const email = await prisma.trackedEmail.findUnique({
            where: { id },
            include: {
                opens: {
                    orderBy: { openedAt: 'desc' }
                }
            }
        });

        if (!email) {
            return reply.status(404).send({ error: 'Not Found' });
        }

        reply.send(email);
    });
};

export default statsRoutes;
