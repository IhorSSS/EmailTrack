import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { CONFIG } from './config';

import trackRoutes from './routes/track';
import registerRoutes from './routes/register';
import statsRoutes from './routes/stats';
import dashboardRoutes from './routes/dashboard';
import authRoutes from './routes/auth';

export function buildApp(): FastifyInstance {
    const app = Fastify({
        logger: true
    });

    app.register(helmet, {
        // Customize contentSecurityPolicy if needed, currently using defaults suitable for APIs
    });

    app.register(cors, {
        origin: (origin, cb) => {
            const allowedOrigins = CONFIG.CORS_ORIGINS;

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
        max: CONFIG.RATE_LIMIT.MAX,
        timeWindow: CONFIG.RATE_LIMIT.WINDOW,
        cache: CONFIG.RATE_LIMIT.CACHE,
        allowList: CONFIG.RATE_LIMIT.ALLOW_LIST,
        // Skip rate limiting for auth/dashboard (trusted endpoints)
        skipOnError: false, // FAIL SAFE: If rate limit store fails, do NOT allow unlimited requests.
    });

    app.register(trackRoutes, { prefix: '/track' });
    app.register(registerRoutes, { prefix: '/register' });
    app.register(statsRoutes, { prefix: '/stats' });
    app.register(dashboardRoutes, { prefix: '/dashboard' });
    app.register(authRoutes, { prefix: '/auth' });

    app.get('/', async () => {
        return { message: 'EmailTrack Backend is Running 🚀', version: CONFIG.VERSION };
    });

    app.get('/version', async () => {
        return { version: CONFIG.VERSION };
    });


    app.get('/health', async () => {
        return { status: 'ok', version: CONFIG.VERSION };
    });


    return app;
}
