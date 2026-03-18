import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TrackerService } from '../../services/TrackerService';
import { TRACKING_CONSTANTS } from '../../config/constants';

const transparentGif = TRACKING_CONSTANTS.PIXEL_GIF;

const trackRoutes: FastifyPluginAsync = async (fastify, opts) => {
    const TrackQuerySchema = z.object({
        id: z.string().min(1),
        t: z.string().optional()
    });

    // Support both /track.gif?id=... and legacy /track/:id formats
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

        // Ignore HEAD requests
        if (request.method === 'HEAD') {
            return reply
                .headers(TRACKING_CONSTANTS.HEADERS.GIF)
                .send(transparentGif);
        }

        // Dedicated Service call (Simplified controller)
        await TrackerService.recordOpen(id, ip, userAgent, t);

        reply
            .headers(TRACKING_CONSTANTS.HEADERS.GIF)
            .send(transparentGif);
    });

    // Alias for track.gif to evade ad-blockers
    fastify.get('/img.png', async (request, reply) => {
        const parseResult = TrackQuerySchema.safeParse(request.query);

        if (!parseResult.success) {
            return reply
                .headers(TRACKING_CONSTANTS.HEADERS.PNG)
                .send(transparentGif);
        }

        const { id, t } = parseResult.data;
        const ip = request.headers['x-forwarded-for'] as string || request.ip;
        const userAgent = request.headers['user-agent'] || '';

        await TrackerService.recordOpen(id, ip, userAgent, t);

        reply
            .headers(TRACKING_CONSTANTS.HEADERS.PNG)
            .send(transparentGif);
    });

    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { t } = request.query as { t?: string };
        const ip = request.headers['x-forwarded-for'] as string || request.ip;
        const userAgent = request.headers['user-agent'] || '';

        if (!id || id.length > 100) {
            return reply.status(400).send({ error: 'Invalid ID' });
        }

        await TrackerService.recordOpen(id, ip, userAgent, t);

        reply
            .headers(TRACKING_CONSTANTS.HEADERS.GIF)
            .send(transparentGif);
    });
};

export default trackRoutes;

