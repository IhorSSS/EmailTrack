import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { recordOpen } from '../../services/tracker';

const transparentGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const trackRoutes: FastifyPluginAsync = async (fastify, opts) => {
    const TrackQuerySchema = z.object({
        id: z.string().min(1),
        t: z.string().optional()
    });

    // Support both /track/:id and /track.gif?id=... formats
    fastify.get('/track.gif', async (request, reply) => {
        const parseResult = TrackQuerySchema.safeParse(request.query);

        if (!parseResult.success) {
            return reply
                .status(400)
                .send({ error: 'Invalid query parameters', details: parseResult.error.format() });
        }

        const { id, t } = parseResult.data;
        const ip = request.headers['x-forwarded-for'] as string || request.ip;
        const userAgent = request.headers['user-agent'] || '';

        // Ignore HEAD requests (often used for pre-fetching/checking)
        if (request.method === 'HEAD') {
            return reply
                .header('Content-Type', 'image/gif')
                .send(transparentGif);
        }

        try {
            await recordOpen(id, ip, userAgent, t);
        } catch (e) {
            request.log.error(e);
        }

        reply
            .header('Content-Type', 'image/gif')
            .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            .header('Pragma', 'no-cache')
            .header('Expires', '0')
            .send(transparentGif);
    });

    // Alias for track.gif to evade ad-blockers (Added img.png)
    fastify.get('/img.png', async (request, reply) => {
        const parseResult = TrackQuerySchema.safeParse(request.query);

        if (!parseResult.success) {
            // Silently fail with 1x1 gif for trackers/bots to avoid error logs/detection
            return reply
                .header('Content-Type', 'image/png')
                .send(transparentGif);
        }

        const { id, t } = parseResult.data;
        const ip = request.headers['x-forwarded-for'] as string || request.ip;
        const userAgent = request.headers['user-agent'] || '';

        try {
            await recordOpen(id, ip, userAgent, t);
        } catch (e) {
            request.log.error(e);
        }

        reply
            .header('Content-Type', 'image/png')
            .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            .header('Pragma', 'no-cache')
            .header('Expires', '0')
            .send(transparentGif);
    });

    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { t } = request.query as { t?: string };
        const ip = request.headers['x-forwarded-for'] as string || request.ip;
        const userAgent = request.headers['user-agent'] || '';

        // Validate generic ID if needed, but usually :id is string by default.
        // We can add check if id is empty or weird.
        if (!id || id.length > 100) {
            return reply.status(400).send({ error: 'Invalid ID' });
        }

        try {
            await recordOpen(id, ip, userAgent, t);
        } catch (e) {
            request.log.error(e);
        }

        reply
            .header('Content-Type', 'image/gif')
            .header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
            .header('Pragma', 'no-cache')
            .header('Expires', '0')
            .send(transparentGif);
    });
};

export default trackRoutes;
