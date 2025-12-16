import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { UserService } from '../../services/UserService';
import { verifyGoogleToken } from '../../utils/auth';
import { authenticate } from '../../middleware/authMiddleware';

const authRoutes: FastifyPluginAsync = async (fastify, opts) => {

    // --- Schemas ---
    const LoginSchema = z.object({
        googleId: z.string().optional(),
        email: z.string().email(),
        token: z.string().min(1, 'Authentication token is required')
    });

    const SyncSchema = z.object({
        email: z.string().email(),
        emails: z.array(z.any()).max(1000, 'Batch too large')
    });

    const ConflictCheckSchema = z.object({
        emailIds: z.array(z.string())
    });

    fastify.post('/login', async (request, reply) => {
        const parseResult = LoginSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid login request', details: parseResult.error.format() });
        }

        const { googleId, email, token } = parseResult.data;

        // Note: Missing email check is handled by Zod .email() above
        // Note: Missing token check is handled by Zod .min(1) above

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

        const parseResult = SyncSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid sync request', details: parseResult.error.format() });
        }

        const { email, emails } = parseResult.data;

        // Length limit handled by Zod .max(1000)

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

        const parseResult = ConflictCheckSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid conflict check request', details: parseResult.error.format() });
        }

        const { emailIds } = parseResult.data;

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
