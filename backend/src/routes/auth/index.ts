import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { UserService } from '../../services/UserService';
import { AuthService } from '../../services/AuthService';
import { authenticate } from '../../middleware/authMiddleware';
import { logger } from '../../utils/logger';

const authRoutes: FastifyPluginAsync = async (fastify, opts) => {

    const LoginSchema = z.object({
        googleId: z.string().optional(),
        email: z.string().email(),
        token: z.string().min(1, 'Authentication token is required')
    });

    const SyncSchema = z.object({
        email: z.string().email(),
        emails: z.array(z.object({
            id: z.string().min(1),
            subject: z.string(),
            recipient: z.string(),
            createdAt: z.string().or(z.date()),
            openCount: z.number().int().nonnegative().optional(),
            opens: z.array(z.unknown()).optional()
        })).max(1000, 'Batch too large')
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

        try {
            const authInfo = await AuthService.verifyGoogleToken(token);
            const verifiedGoogleId = authInfo.googleId;
            const tokenEmail = authInfo.email;

            if (googleId && googleId !== verifiedGoogleId) {
                logger.warn(`[Auth] Mismatch: Body ID ${googleId} !== Token ID ${verifiedGoogleId}`);
            }

            if (tokenEmail && tokenEmail !== email) {
                logger.warn(`[Auth] Email Mismatch: Body Email ${email} !== Token Email ${tokenEmail}`);
            }

            const user = await UserService.createOrUpdate(email, verifiedGoogleId);
            return reply.send({ user });
        } catch (e) {
            logger.warn(`[Auth] Login failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
            return reply.status(401).send({ error: 'Authentication failed' });
        }
    });

    fastify.post('/sync', async (request, reply) => {
        const authInfo = await authenticate(request, reply);
        if (!authInfo) return;

        const parseResult = SyncSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid sync request', details: parseResult.error.format() });
        }

        const { email, emails } = parseResult.data;

        try {
            const user = await UserService.createOrUpdate(email, authInfo.googleId);

            if (emails.length > 0) {
                await UserService.batchLinkEmails(user.id, emails);
            }
            return reply.send({ success: true, count: emails.length });
        } catch (e) {
            logger.error('[Auth] Sync error:', e);
            return reply.status(500).send({ error: 'Internal Sync Error' });
        }
    });

    fastify.post('/check-conflicts', async (request, reply) => {
        const authInfo = await authenticate(request, reply);
        if (!authInfo) return;

        const parseResult = ConflictCheckSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid conflict check request', details: parseResult.error.format() });
        }

        try {
            const conflict = await UserService.hasOwnershipConflict(parseResult.data.emailIds, authInfo.googleId);
            return reply.send({ conflict });
        } catch (e) {
            logger.error('[Auth] Conflict check error:', e);
            return reply.status(500).send({ error: 'Internal Conflict Check Error' });
        }
    });
};

export default authRoutes;

