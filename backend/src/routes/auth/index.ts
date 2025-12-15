import { FastifyPluginAsync } from 'fastify';
import { UserService } from '../../services/UserService';

const authRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.post('/login', async (request, reply) => {
        const { googleId, email } = request.body as { googleId: string, email: string };

        if (!googleId || !email) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        try {
            // In a real app, verify the token here using google-auth-library
            // For MVP, we trust the extension sent valid googleId/email from chrome.identity

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
};

export default authRoutes;
