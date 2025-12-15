import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

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
        origin: '*', // Allow all for now, lock down later
        allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
        methods: ['GET', 'POST', 'OPTIONS']
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
