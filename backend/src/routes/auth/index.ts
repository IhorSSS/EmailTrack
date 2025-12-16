import { FastifyPluginAsync } from 'fastify';
import { UserService } from '../../services/UserService';
import { verifyGoogleToken } from '../../utils/auth';

const authRoutes: FastifyPluginAsync = async (fastify, opts) => {

    // Helper to extract and verify token
    const authenticate = async (request: any, reply: any) => {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            reply.status(401).send({ error: 'Missing Authorization header' });
            return null;
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            reply.status(401).send({ error: 'Invalid Authorization header format' });
            return null;
        }

        try {
            const googleId = await verifyGoogleToken(token);
            return googleId;
        } catch (e) {
            request.log.warn(`[Auth] Token verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
            reply.status(401).send({ error: 'Invalid or expired token' });
            return null;
        }
    };

    fastify.post('/login', async (request, reply) => {
        const { googleId, email, token } = request.body as { googleId?: string, email: string, token?: string };

        if (!email) {
            return reply.status(400).send({ error: 'Missing email' });
        }

        // Security Enforcement: Token is now REQUIRED.
        if (!token) {
            return reply.status(401).send({ error: 'Authentication token is required.' });
        }

        let verifiedGoogleId: string | null = null;
        try {
            verifiedGoogleId = await verifyGoogleToken(token);
        } catch (e) {
            request.log.warn(`[Auth] Invalid token for ${email}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            return reply.status(401).send({ error: 'Invalid authentication token' });
        }

        // Optional: mismatch check
        if (googleId && googleId !== verifiedGoogleId) {
            request.log.warn(`[Auth] Mismatch: Body ID ${googleId} !== Token ID ${verifiedGoogleId}`);
        }

        try {
            // verifiedGoogleId is guaranteed not null here due to verifyGoogleToken throwing or returning string
            const user = await UserService.createOrUpdate(email, verifiedGoogleId);
            return reply.send({ user });
        } catch (e) {
            request.log.error(e);
            return reply.status(500).send({ error: 'Internal User Sync Error' });
        }
    });

    fastify.post('/sync', async (request, reply) => {
        // Authenticate first
        const verifiedGoogleId = await authenticate(request, reply);
        if (!verifiedGoogleId) return; // Reply already sent

        const { email, emails } = request.body as { email: string, emails: any[] };

        if (!email || !Array.isArray(emails)) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        // SECURITY: Limit batch size
        if (emails.length > 1000) {
            return reply.status(400).send({ error: 'Batch too large. Maximum 1000 emails per sync.' });
        }

        try {
            // Ensure we are syncing to the correct user
            const user = await UserService.createOrUpdate(email, verifiedGoogleId);

            if (emails.length > 0) {
                await UserService.batchLinkEmails(user.id, emails);
            }
            return reply.send({ success: true, count: emails.length });
        } catch (e) {
            request.log.error(e);
            return reply.status(500).send({ error: 'Internal Sync Error' });
        }
    });

    fastify.post('/check-conflicts', async (request, reply) => {
        // Authenticate first
        const verifiedGoogleId = await authenticate(request, reply);
        if (!verifiedGoogleId) return; // Reply already sent

        const { emailIds } = request.body as { emailIds: string[] };

        if (!Array.isArray(emailIds)) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }

        try {
            const conflict = await UserService.hasOwnershipConflict(emailIds, verifiedGoogleId);
            return reply.send({ conflict });
        } catch (e) {
            request.log.error(e);
            return reply.status(500).send({ error: 'Internal Conflict Check Error' });
        }
    });
};

export default authRoutes;
