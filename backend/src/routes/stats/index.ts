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

        if (authInfo) {
            // Case 1: Requester is logged in
            // MUST be the owner of the email.
            // (We no longer allow viewing "Incognito" emails by sender hint if you are logged in, 
            // as those might belong to another local session. Badges == Dashboard.)
            const u = await prisma.user.findUnique({ where: { googleId: authInfo.googleId } });
            if (!email.ownerId || email.ownerId !== u?.id) {
                return reply.status(404).send({ error: 'Not Found' });
            }
        } else {
            // Case 2: Requester is NOT logged in (Incognito)
            // We allow viewing based on sender hint if the email is unowned.
            if (email.ownerId) {
                // Cannot view owned emails without auth
                return reply.status(404).send({ error: 'Not Found' });
            }

            const emailUser = email.user?.toLowerCase();
            const hintEmail = senderHint?.toLowerCase();

            if (!emailUser || !hintEmail || emailUser !== hintEmail) {
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
