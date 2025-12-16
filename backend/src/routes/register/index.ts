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

        // Robustness: If ownerId is provided, ensure the user exists!
        // This fixes the "Foreign key constraint violated" (P2003) error if syncUser failed or hasn't run.
        if (ownerId && user) {
            try {
                await prisma.user.upsert({
                    where: { id: ownerId },
                    update: { email: user }, // Ensure email is fresh
                    create: {
                        id: ownerId,
                        email: user,
                        googleId: ownerId
                    }
                });
                console.log(`[REGISTER] Ensured user exists: ${ownerId} (${user})`);
            } catch (userErr) {
                console.warn('[REGISTER] Failed to auto-create user, proceeding without ownership linking if possible:', userErr);
                // If this fails, the next step (TrackedEmail creation) might fail with FK error,
                // or we could fallback to setting ownerId = null? 
                // Let's let it fail or wrap it?
                // Actually, if this fails, likely something is really wrong.
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
