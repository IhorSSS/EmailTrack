import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getAuthenticatedUser } from '../../middleware/authMiddleware';
import { DashboardService } from '../../services/DashboardService';
import { logger } from '../../utils/logger';

const GetDashboardQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(1000).default(20),
    user: z.string().optional(),
    ownerId: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val[0] : val).optional(),
    ids: z.union([z.string(), z.array(z.string())]).transform(val => Array.isArray(val) ? val[0] : val).optional(),
    since: z.string().optional()
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
        const parseResult = GetDashboardQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid query parameters', details: parseResult.error.format() });
        }

        const { page, limit, user, ownerId, ids, since } = parseResult.data;
        const idList = ids ? ids.split(',').filter(Boolean) : undefined;

        if (!ownerId && !idList && !user) {
            return reply.status(400).send({ error: 'Query too broad. Specify user, ownerId, or ids.' });
        }

        try {
            const authInfo = await getAuthenticatedUser(request);
            const result = await DashboardService.getDashboardData({
                page,
                limit,
                user,
                ownerId,
                ids: idList,
                since
            }, authInfo);

            reply.send(result);
        } catch (err) {
            if (err instanceof Error && err.message === 'FORBIDDEN_ACCESS') {
                return reply.status(403).send({ error: 'Forbidden: You can only access your own data.' });
            }
            logger.error('Dashboard fetch error:', err);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.delete('/', async (request, reply) => {
        const parseResult = DeleteDashboardQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid query parameters', details: parseResult.error.format() });
        }

        const { user, ownerId, ids } = parseResult.data;
        const idList = ids ? ids.split(',').filter(Boolean) : undefined;

        try {
            const authInfo = await getAuthenticatedUser(request);
            const result = await DashboardService.deleteDashboardData({
                user,
                ownerId,
                ids: idList
            }, authInfo);

            reply.send({ success: true, count: result.count });
        } catch (err) {
            if (err instanceof Error && (err.message === 'FORBIDDEN_ACCESS' || err.message === 'FORBIDDEN_OWNERSHIP')) {
                return reply.status(403).send({ error: 'Forbidden: Cannot delete items you do not own.' });
            }
            logger.error('Failed to delete history:', err);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    // Secure Sync Endpoint for Anonymous/Local Mode
    fastify.post('/sync', async (request, reply) => {
        const SyncBodySchema = z.object({
            ids: z.array(z.string()).min(1).max(1000)
        });

        const parseResult = SyncBodySchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.format() });
        }

        try {
            const data = await DashboardService.syncDashboardData(parseResult.data.ids);
            reply.send({ data });
        } catch (err) {
            logger.error('Failed to sync dashboard data:', err);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.get('/emails/:id/opens', async (request, reply) => {
        const QuerySchema = z.object({
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).max(100).default(50)
        });

        const ParamsSchema = z.object({
            id: z.string()
        });

        const queryParse = QuerySchema.safeParse(request.query);
        const paramsParse = ParamsSchema.safeParse(request.params);

        if (!queryParse.success || !paramsParse.success) {
            return reply.status(400).send({ error: 'Invalid parameters' });
        }

        const { id } = paramsParse.data;
        const { page, limit } = queryParse.data;
        const skip = (page - 1) * limit;

        try {
            // Optional auth - public emails can be viewed without auth, owned emails require auth
            let authInfo = null;
            try {
                authInfo = await getAuthenticatedUser(request);
            } catch {
                // Ignore auth error, DashboardService.getEmailOpens will check if auth is required
            }
            
            const data = await DashboardService.getEmailOpens(id, skip, limit, authInfo);
            reply.send(data);
        } catch (err) {
            if (err instanceof Error && err.message === 'NOT_FOUND') {
                return reply.status(404).send({ error: 'Email not found' });
            }
            if (err instanceof Error && err.message === 'FORBIDDEN_ACCESS') {
                return reply.status(403).send({ error: 'Forbidden' });
            }
            logger.error('Failed to get opens:', err);
            reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
};


export default dashboardRoutes;
