import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';

const registerRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.post('/', async (request, reply) => {
        const { id, subject, recipient, body, user, ownerId } = request.body as {
            id?: string,
            subject?: string,
            recipient?: string,
            body?: string,
            user?: string,
            ownerId?: string
        };
        console.log(`[REGISTER] Attempting to register email. ID: ${id}, User: ${user}, OwnerId: ${ownerId}`);

        // Use upsert to handle duplicate IDs gracefully
        const email = await prisma.trackedEmail.upsert({
            where: { id: id || 'never-exists' }, // Fallback for auto-generated IDs
            update: {
                subject,
                recipient,
                body,
                user,
                ownerId
            },
            create: {
                id,
                subject,
                recipient,
                body,
                user,
                ownerId
            }
        });

        const protocol = request.protocol;
        const host = request.headers.host;
        const pixelUrl = `${protocol}://${host}/track/${email.id}`;

        reply.status(201).send({
            id: email.id,
            pixelUrl
        });
    });
};

export default registerRoutes;
