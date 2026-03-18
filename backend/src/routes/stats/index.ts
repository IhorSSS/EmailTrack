import { FastifyPluginAsync } from 'fastify';
import { PMService } from '../../services/PMService';

const statsRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        const stats = await PMService.getEmailStats(id);

        if (!stats) {
            return reply.status(404).send({ error: 'Not Found' });
        }

        // OWNERSHIP VALIDATION
        // RELAXATION: Possessing the valid UUID (Proof of Knowledge) is sufficient for read-only access.
        // This ensures badges work consistently whether logged in, logged out, or in multi-account environments.
        // We do NOT strictly enforce ownership for stats, unlike the Dashboard which lists private data.

        reply.send(stats);
    });
};

export default statsRoutes;
