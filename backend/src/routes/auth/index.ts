import { FastifyPluginAsync } from 'fastify';
import { UserService } from '../../services/UserService';

const authRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.post('/login', async (request, reply) => {
        const { googleId, email } = request.body as { googleId: string, email: string };

        if (!googleId || !email) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        try {
            // TODO: SECURITY - Verify Google OAuth token before production!
            // Current MVP trusts chrome.identity, but this allows account takeover.
            // Required for production:
            // 1. npm install google-auth-library
            // 2. Verify idToken from request.body.token
            // 3. Extract googleId from verified payload
            // See: https://developers.google.com/identity/sign-in/web/backend-auth

            const user = await UserService.createOrUpdate(email, googleId);
            return reply.send({ user });
        } catch (e) {
            console.error('Login error:', e);
            return reply.status(500).send({ error: 'Internal User Sync Error' });
        }
    });

    fastify.post('/sync', async (request, reply) => {
        const { googleId, email, emails } = request.body as { googleId: string, email: string, emails: any[] };

        if (!googleId || !email || !Array.isArray(emails)) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        // SECURITY: Limit batch size to prevent DoS
        if (emails.length > 1000) {
            return reply.status(400).send({ error: 'Batch too large. Maximum 1000 emails per sync.' });
        }

        try {
            const user = await UserService.createOrUpdate(email, googleId);
            if (emails.length > 0) {
                await UserService.batchLinkEmails(user.id, emails);
            }
            return reply.send({ success: true, count: emails.length });
        } catch (e) {
            console.error('Sync error:', e);
            return reply.status(500).send({ error: 'Internal Sync Error' });
        }
    });

    fastify.post('/check-conflicts', async (request, reply) => {
        const { googleId, emailIds } = request.body as { googleId: string, emailIds: string[] };

        if (!googleId || !Array.isArray(emailIds)) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        try {
            const conflict = await UserService.hasOwnershipConflict(emailIds, googleId);
            return reply.send({ conflict });
        } catch (e) {
            console.error('Conflict check error:', e);
            return reply.status(500).send({ error: 'Internal Conflict Check Error' });
        }
    });
};

export default authRoutes;
