import { FastifyPluginAsync } from 'fastify';
import { recordOpen } from '../../services/tracker';

const transparentGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const trackRoutes: FastifyPluginAsync = async (fastify, opts) => {
    // Support both /track/:id and /track.gif?id=... formats
    fastify.get('/track.gif', async (request, reply) => {
        const { id, t } = request.query as { id: string; t?: string };
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

    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { t } = request.query as { t?: string };
        const ip = request.headers['x-forwarded-for'] as string || request.ip;
        const userAgent = request.headers['user-agent'] || '';

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
