
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyGoogleToken } from '../utils/auth';

// Extend FastifyRequest to include user context if desired, or just return the ID
declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            googleId: string;
        };
    }
}

/**
 * Middleware to authenticate requests using Google OAuth Token.
 * Returns the Google ID if successful, or sends 401/500 and returns null.
 * 
 * Usage:
 * const googleId = await authenticate(request, reply);
 * if (!googleId) return; // Response already sent
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
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
        const googleId = await verifyGoogleToken(token);
        // Attach to request for convenience in downstream handlers if needed
        request.user = { googleId };
        return googleId;
    } catch (e) {
        request.log.warn(`[Auth] Token verification failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        reply.status(401).send({ error: 'Invalid or expired token' });
        return null;
    }
}

/**
 * Optional Authentication:
 * Returns Google ID if token is valid.
 * Returns null if no token / invalid token (but doesn't halt request).
 * DOES NOT SEND REPLY.
 */
export async function getAuthenticatedUser(request: FastifyRequest): Promise<string | null> {
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
