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

        if (email.owner) {
            // Case 1: Email is owned by an account - MUST be the owner
            if (!authInfo || email.owner.googleId !== authInfo.googleId) {
                return reply.status(404).send({ error: 'Not Found' });
            }
        } else if (authInfo && authInfo.email) {
            // Case 2: Email is Incognito, but requester is LOGGED IN
            // We only show it if the logged-in email matches the sender string
            if (email.user && email.user !== authInfo.email) {
                return reply.status(404).send({ error: 'Not Found' });
            }
        }
        // Case 3: Email is Incognito and requester is NOT logged in
        // Allow public access for now (local unowned tracking)

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
