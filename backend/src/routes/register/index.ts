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
                // 1. Try to find/create by Google ID
                let dbUser = await prisma.user.findUnique({ where: { googleId: ownerId } });

                if (!dbUser) {
                    // 2. If not found by Google ID, try to find by Email (Legacy/Social mismatch)
                    const existingByEmail = await prisma.user.findUnique({ where: { email: user } });

                    if (existingByEmail) {
                        // MERGE: User exists by email, but hasn't linked Google ID. Link it now.
                        dbUser = await prisma.user.update({
                            where: { id: existingByEmail.id },
                            data: { googleId: ownerId }
                        });
                        console.log(`[REGISTER] Merged existing user ${user} with Google ID ${ownerId}`);
                    } else {
                        // CREATE: User doesn't exist at all. Create new.
                        dbUser = await prisma.user.create({
                            data: {
                                email: user,
                                googleId: ownerId
                            }
                        });
                        console.log(`[REGISTER] Created new user ${user} for Google ID ${ownerId}`);
                    }
                }

                validOwnerUuid = dbUser.id;
            } catch (err) {
                console.error('[REGISTER] User resolution failed completely:', err);
                // validOwnerUuid remains null, email will be incognito
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

        console.log('[REGISTER] FINAL DB SAVE:', {
            id: email.id,
            ownerId_input: validOwnerUuid,
            ownerId_saved: email.ownerId,
            user_field: email.user
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
