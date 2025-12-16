import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

import trackRoutes from './routes/track';
import registerRoutes from './routes/register';
import statsRoutes from './routes/stats';
import dashboardRoutes from './routes/dashboard';
import authRoutes from './routes/auth';

export function buildApp(): FastifyInstance {
    const app = Fastify({
        logger: true
    });

    app.register(cors, {
        origin: (origin, cb) => {
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:5173',
                // Chrome Extension Protocol
                /^chrome-extension:\/\/.*$/
            ];

            if (!origin || allowedOrigins.some(allowed => allowed instanceof RegExp ? allowed.test(origin) : allowed === origin)) {
                cb(null, true);
                return;
            }
            cb(new Error("Not allowed"), false);
        },
        allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
        methods: ['GET', 'POST', 'OPTIONS', 'DELETE']
    });

    // Rate limiting - 100 requests per minute per IP
    app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
        cache: 10000,
        allowList: ['127.0.0.1'],
        // Skip rate limiting for auth/dashboard (trusted endpoints)
        skipOnError: true,
    });

    app.register(trackRoutes, { prefix: '/track' });
    app.register(registerRoutes, { prefix: '/register' });
    app.register(statsRoutes, { prefix: '/stats' });
    app.register(dashboardRoutes, { prefix: '/dashboard' });
    app.register(authRoutes, { prefix: '/auth' });

    app.get('/', async () => {
        return { message: 'EmailTrack Backend is Running 🚀' };
    });

    app.get('/health', async () => {
        return { status: 'ok' };
    });

    return app;
}
