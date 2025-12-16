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

        // CORRECTION: The 'ownerId' sent from Frontend is actually the GOOGLE ID.
        // But the DB 'TrackedEmail.ownerId' expects a USER UUID (Foreign Key).
        // We must resolve the User UUID from the Google ID.

        let validOwnerUuid: string | null = null;

        if (ownerId && user) {
            try {
                // Upsert User by GOOGLE ID (not ID)
                const dbUser = await prisma.user.upsert({
                    where: { googleId: ownerId },
                    update: { email: user },
                    create: {
                        email: user,
                        googleId: ownerId
                    }
                });
                validOwnerUuid = dbUser.id;
                console.log(`[REGISTER] Resolved GoogleId ${ownerId} -> User UUID ${validOwnerUuid}`);
            } catch (userErr) {
                console.warn('[REGISTER] Failed to resolve user from Google ID:', userErr);
            }
        }

        // Use upsert to handle duplicate IDs gracefully
        const email = await prisma.trackedEmail.upsert({
            where: { id: id || 'never-exists' }, // Fallback for auto-generated IDs
            update: {
                subject,
                recipient,
                body,
                user,
                ownerId: validOwnerUuid // Use resolved UUID
            },
            create: {
                id,
                subject,
                recipient,
                body,
                user,
                ownerId: validOwnerUuid // Use resolved UUID
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
