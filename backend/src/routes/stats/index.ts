import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';
import { getAuthenticatedUser } from '../../middleware/authMiddleware';

const statsRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        const email = await prisma.trackedEmail.findUnique({
            where: { id },
            include: {
                opens: {
                    orderBy: { openedAt: 'desc' }
                },
                owner: true // Include owner for validation
            }
        });

        if (!email) {
            return reply.status(404).send({ error: 'Not Found' });
        }

        // OWNERSHIP VALIDATION
        const authInfo = await getAuthenticatedUser(request);
        const senderHint = request.headers['x-sender-hint'] as string | undefined;

        if (email.owner) {
            // Case 1: Email is owned by an account - MUST be the owner
            if (!authInfo || email.owner.googleId !== authInfo.googleId) {
                return reply.status(404).send({ error: 'Not Found' });
            }
        } else {
            // Case 2 & 3: Email is Incognito (Unowned)
            // We only show it if the requester proves they are the sender
            const emailUser = email.user?.toLowerCase();
            const authEmail = authInfo?.email?.toLowerCase();
            const hintEmail = senderHint?.toLowerCase();

            if (!emailUser) {
                // Should not happen for tracked emails, but block for safety
                return reply.status(404).send({ error: 'Not Found' });
            }

            // Priority: Authenticated Email > Sender Hint
            const requesterIdentity = authEmail || hintEmail;

            if (!requesterIdentity || emailUser !== requesterIdentity) {
                return reply.status(404).send({ error: 'Not Found' });
            }
        }

        // SECURITY: Don't expose sensitive data (subject, body, recipient, ownerId)
        // Only return anonymized tracking stats
        reply.send({
            id: email.id,
            tracked: true,
            openCount: email.opens.length,
            opens: email.opens.map(open => ({
                openedAt: open.openedAt,
                device: open.device, // Already anonymized by tracker
                location: open.location // City/Country only
            }))
        });
    });
};

export default statsRoutes;
