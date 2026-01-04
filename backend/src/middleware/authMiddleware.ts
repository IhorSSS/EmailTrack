
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyGoogleToken } from '../utils/auth';

import { GoogleAuthInfo } from '../utils/auth';

// Extend FastifyRequest to include user context
declare module 'fastify' {
    interface FastifyRequest {
        user?: GoogleAuthInfo;
    }
}

/**
 * Middleware to authenticate requests using Google OAuth Token.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<GoogleAuthInfo | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        reply.status(401).send({ error: 'Missing Authorization header' });
        return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        reply.status(401).send({ error: 'Invalid Authorization header format' });
        return null;
    }

    try {
        const authInfo = await verifyGoogleToken(token);
        request.user = authInfo;
        return authInfo;
    } catch (e) {
        request.log.warn(`[Auth] Token verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        reply.status(401).send({ error: 'Invalid or expired token' });
        return null;
    }
}

/**
 * Optional Authentication:
 * Returns GoogleAuthInfo if token is valid.
 */
export async function getAuthenticatedUser(request: FastifyRequest): Promise<GoogleAuthInfo | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    try {
        return await verifyGoogleToken(token);
    } catch (e) {
        return null;
    }
}
