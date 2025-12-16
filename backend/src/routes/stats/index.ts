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

        // OWNERSHIP VALIDATION (when authenticated)
        // If user sends Authorization header, verify they own this email
        const authGoogleId = await getAuthenticatedUser(request);

        if (authGoogleId) {
            // User is authenticated - check ownership
            if (email.owner && email.owner.googleId !== authGoogleId) {
                // Email is owned by someone else
                return reply.status(404).send({ error: 'Not Found' });
            }
            // Note: If email.owner is null (incognito), authenticated user can see it
            // This allows viewing old incognito emails after login
        }
        // If no auth header, allow public access (for backward compatibility with pixel tracking)

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
