import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db';
import { getAuthenticatedUser } from '../../middleware/authMiddleware';

const registerRoutes: FastifyPluginAsync = async (fastify, opts) => {
    const RegisterBodySchema = z.object({
        id: z.string().optional(),
        subject: z.string().optional(),
        recipient: z.string().optional(),
        cc: z.string().nullable().optional(),
        bcc: z.string().nullable().optional(),
        body: z.string().optional(),
        user: z.string().optional(),
        ownerId: z.string().optional()
    });

    fastify.post('/', async (request, reply) => {
        const parseResult = RegisterBodySchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid request body', details: parseResult.error.format() });
        }

        const { id, subject, recipient, cc, bcc, body, user, ownerId } = parseResult.data;
        console.log(`[REGISTER] Attempting to register email. ID: ${id}, User: ${user}`);

        // SECURITY: Verify the claimed ownerId against the actual Auth Token
        const authInfo = await getAuthenticatedUser(request);
        const authenticatedGoogleId = authInfo?.googleId || null;
        let verifiedGoogleId: string | null = null;

        if (ownerId) {
            if (ownerId === authenticatedGoogleId) {
                verifiedGoogleId = ownerId;
            } else {
                if (authenticatedGoogleId) {
                    console.warn(`[REGISTER] OwnerId mismatch! Claimed: ${ownerId}, Verified: ${authenticatedGoogleId}. Using Verified.`);
                    verifiedGoogleId = authenticatedGoogleId;
                } else {
                    console.warn(`[REGISTER] Unauthenticated attempt to set ownerId ${ownerId}. Ignoring.`);
                    verifiedGoogleId = null;
                }
            }
        } else if (authenticatedGoogleId) {
            verifiedGoogleId = authenticatedGoogleId;
        }

        // Resolve Email (Use 'user' from body, or fallback to authenticated email)
        const primaryEmail = user || authInfo?.email;

        // CORRECTION: The 'ownerId' sent from Frontend (and verified now) is the GOOGLE ID.
        // We must resolve the User UUID from the Google ID.
        let validOwnerUuid: string | null = null;

        if (verifiedGoogleId && primaryEmail) {
            try {
                // 1. Try to find/create by Google ID
                let dbUser = await prisma.user.findUnique({ where: { googleId: verifiedGoogleId } });

                if (!dbUser) {
                    // 2. If not found by Google ID, try to find by Email
                    const existingByEmail = await prisma.user.findUnique({ where: { email: primaryEmail } });

                    if (existingByEmail) {
                        // MERGE
                        dbUser = await prisma.user.update({
                            where: { id: existingByEmail.id },
                            data: { googleId: verifiedGoogleId }
                        });
                        console.log(`[REGISTER] Merged existing user ${primaryEmail} with Google ID ${verifiedGoogleId}`);
                    } else {
                        // CREATE
                        dbUser = await prisma.user.create({
                            data: {
                                email: primaryEmail,
                                googleId: verifiedGoogleId
                            }
                        });
                        console.log(`[REGISTER] Created new user ${primaryEmail} for Google ID ${verifiedGoogleId}`);
                    }
                }
                validOwnerUuid = dbUser.id;
            } catch (err) {
                console.error('[REGISTER] User resolution failed completely:', err);
            }
        }

        // SECURITY CHECK: If email exists and has an owner, verify requester ownership
        if (id) {
            const existingEmail = await prisma.trackedEmail.findUnique({
                where: { id },
                select: { ownerId: true }
            });

            if (existingEmail && existingEmail.ownerId && existingEmail.ownerId !== validOwnerUuid) {
                console.warn(`[REGISTER] Hijack attempt! User ${validOwnerUuid || 'Anonymous'} tried to register email ${id} owned by ${existingEmail.ownerId}`);
                return reply.status(403).send({ error: 'Forbidden: Email belongs to another account' });
            }
        }

        // Use upsert to handle duplicate IDs gracefully
        const email = await prisma.trackedEmail.upsert({
            where: { id: id || 'never-exists' }, // Fallback for auto-generated IDs
            update: {
                subject,
                recipient,
                cc,
                bcc,
                body,
                user,
                ownerId: validOwnerUuid // Use resolved UUID
            },
            create: {
                id,
                subject,
                recipient,
                cc,
                bcc,
                body,
                user,
                ownerId: validOwnerUuid // Use resolved UUID
            }
        });

        request.log.info(`[REGISTER] Registering email. ID: ${id}, User: ${user}, Owner: ${email.ownerId || 'None'}`);

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
