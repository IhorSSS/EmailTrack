import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';

const registerRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.post('/', async (request, reply) => {
        const { id, subject, recipient, body, user } = request.body as { id?: string, subject?: string, recipient?: string, body?: string, user?: string };
        console.log(`[REGISTER] Attempting to register email. ID: ${id}, User: ${user}`);

        const email = await prisma.trackedEmail.create({
            data: {
                id, // Optional, if provided will be used
                subject,
                recipient,
                body,
                user
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
