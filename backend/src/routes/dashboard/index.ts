import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db';
import { z } from 'zod';
import { authenticate, getAuthenticatedUser } from '../../middleware/authMiddleware';
import { DashboardService } from '../../services/DashboardService';
import { logger } from '../../utils/logger';

const GetDashboardQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(1000).default(20), // Cap limit at 1000 for safety
    user: z.string().optional(),
    ownerId: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val[0] : val).optional(),
    ids: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val[0] : val).optional()
});

const DeleteDashboardQuerySchema = z.object({
    user: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val[0] : val).optional(),
    ownerId: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val[0] : val).optional(),
    ids: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val[0] : val).optional()
}).refine(data => data.user || data.ownerId || data.ids, {
    message: "At least one filter (user, ownerId, or ids) is required"
});

const dashboardRoutes: FastifyPluginAsync = async (fastify, opts) => {
    fastify.get('/', async (request, reply) => {
        let query;
        try {
            query = GetDashboardQuerySchema.parse(request.query);
        } catch (e: any) {
            request.log.error({ error: e, query: request.query }, 'Dashboard schema validation failed');
            return reply.status(400).send({ error: 'Invalid query parameters', details: e.issues || e.message });
        }

        const { page, limit, user, ownerId, ids } = query;

        // AUTHENTICATION CHECK
        const authInfo = await getAuthenticatedUser(request);
        const authGoogleId = authInfo?.googleId || null;

        // Security: If ownerId is requested, it MUST match the authenticated user.
        if (ownerId) {
            if (!authGoogleId) {
                return reply.status(401).send({ error: 'Authentication required to access cloud data.' });
            }
            if (ownerId !== authGoogleId) {
                return reply.status(403).send({ error: 'Forbidden: You can only access your own data.' });
            }
        }

        let resolvedOwnerUuid: string | null = null;

        // Resolve Google ID to User UUID if permitted
        if (ownerId) { // We already verified ownerId === authGoogleId
            const userRecord = await prisma.user.findUnique({ where: { googleId: ownerId } });
            if (userRecord) {
                resolvedOwnerUuid = userRecord.id;
            } else {
                // Authenticated but user record missing? Strange, but safe to return empty.
                resolvedOwnerUuid = '00000000-0000-0000-0000-000000000000';
            }
        }

        // Validate broad query permissions
        const idList = ids ? ids.split(',').filter(Boolean) : undefined;
        if (!ownerId && !idList && !user) {
            return reply.status(400).send({ error: 'Query too broad. Specify user, ownerId, or ids.' });
        }

        try {
            const result = await DashboardService.getDashboardData({
                page,
                limit,
                user,
                ownerId,
                ids: idList,
                resolvedOwnerUuid
            });

            reply.send(result);
        } catch (err) {
            logger.error('Dashboard fetch error:', err);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.delete('/', async (request, reply) => {
        let query;
        try {
            query = DeleteDashboardQuerySchema.parse(request.query);
        } catch (e) {
            return reply.status(400).send({ error: 'At least one filter (user, ownerId, or ids) is required' });
        }
        const { user, ownerId, ids } = query;

        // AUTHENTICATION REQUIRED FOR DELETE
        const authInfo = await getAuthenticatedUser(request);
        const authGoogleId = authInfo?.googleId || null;

        if (ownerId) {
            if (!authGoogleId || ownerId !== authGoogleId) {
                return reply.status(403).send({ error: 'Forbidden' });
            }
        }

        try {
            let resolvedOwnerUuid: string | null = null;
            if (ownerId) { // Verified above
                const u = await prisma.user.findUnique({ where: { googleId: ownerId } });
                if (u) resolvedOwnerUuid = u.id;
            }

            const idList = ids ? ids.split(',').filter(Boolean) : undefined;

            const result = await DashboardService.deleteDashboardData({
                user,
                ownerId,
                ids: idList,
                resolvedOwnerUuid
            });

            reply.send({ success: true, count: result.count });
        } catch (e: any) {
            if (e.message === 'FORBIDDEN_OWNERSHIP') {
                return reply.status(403).send({ error: 'Forbidden: Cannot delete items you do not own.' });
            }
            logger.error('Failed to delete history:', e);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // Secure Sync Endpoint for Anonymous/Local Mode
    // returns only METADATA, no content.
    fastify.post('/sync', async (request, reply) => {
        const SyncBodySchema = z.object({
            ids: z.array(z.string()).min(1).max(1000) // Batch size limit
        });

        let body;
        try {
            body = SyncBodySchema.parse(request.body);
        } catch (e: any) {
            return reply.status(400).send({ error: 'Invalid body', details: e.issues });
        }

        const { ids } = body;

        try {
            const data = await DashboardService.syncDashboardData(ids);
            reply.send({ data });
        } catch (err) {
            logger.error('Sync error:', err);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};

export default dashboardRoutes;
