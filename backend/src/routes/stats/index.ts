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
        const authGoogleId = await getAuthenticatedUser(request).catch(() => null);

        if (email.owner) {
            // Email is owned by a specific account - Authentication REQUIRED
            if (!authGoogleId || email.owner.googleId !== authGoogleId) {
                // If not authenticated or not the owner -> Hide the email's existence
                return reply.status(404).send({ error: 'Not Found' });
            }
        } else {
            // Incognito Email (unowned)
            // Allow public access if no auth header, OR allow if authenticated (anyone can see incognito)
            // This is the intended behavior for unowned local tracking.
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
