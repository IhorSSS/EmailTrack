import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { PMService } from '../../services/PMService';
import { getAuthenticatedUser } from '../../middleware/authMiddleware';
import { logger } from '../../utils/logger';
import { CONFIG } from '../../config';

const registerRoutes: FastifyPluginAsync = async (fastify, opts) => {
    const RegisterBodySchema = z.object({
        id: z.string().optional(),
        subject: z.string().optional(),
        recipient: z.string().optional(),
        cc: z.string().nullable().optional(),
        bcc: z.string().nullable().optional(),
        body: z.string().optional(),
        user: z.string().optional(),
        ownerId: z.string().optional()
    });

    fastify.post('/', async (request, reply) => {
        const parseResult = RegisterBodySchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid request body', details: parseResult.error.format() });
        }

        try {
            const authInfo = await getAuthenticatedUser(request);
            
            // Delegate all logic to PMService
            const email = await PMService.registerEmail(parseResult.data, authInfo);

            logger.info(`[REGISTER] Successfully registered email. ID: ${email.id}, Owner: ${email.ownerId || 'Anonymous'}`);

            const pixelUrl = `${CONFIG.BASE_URL}/track/${email.id}`;

            reply.status(201).send({
                id: email.id,
                pixelUrl
            });
        } catch (error) {
            if (error instanceof Error && error.message === 'FORBIDDEN_OWNERSHIP') {
                return reply.status(403).send({ error: 'Forbidden: Email belongs to another account' });
            }
            logger.error('[REGISTER] Registration failed:', error);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default registerRoutes;


