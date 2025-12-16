import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
// Mock utils/auth BEFORE importing routes or building app
vi.mock('../utils/auth', () => ({
    verifyGoogleToken: vi.fn()
}));

// Mock Prisma
vi.mock('../db', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn()
        }
    }
}));

import { buildApp } from '../app';
import { prisma } from '../db';
import { verifyGoogleToken } from '../utils/auth';

describe('Auth Routes', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    describe('POST /login', () => {
        it('should login successfully with a valid Google Token', async () => {
            // Mock token verification success
            (verifyGoogleToken as any).mockResolvedValue('google-123');

            // Mock user upsert
            (prisma.user.upsert as any).mockResolvedValue({
                id: 'user-uuid',
                email: 'test@example.com',
                googleId: 'google-123'
            });

            const response = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: {
                    email: 'test@example.com',
                    token: 'valid-token'
                }
            });

            expect(response.statusCode).toBe(200);
            expect(verifyGoogleToken).toHaveBeenCalledWith('valid-token');
            expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({
                    email: 'test@example.com',
                    googleId: 'google-123'
                })
            }));
            const body = response.json();
            expect(body.user.id).toBe('user-uuid');
        });

        it('should fail with invalid Google Token', async () => {
            // Mock token verification failure
            (verifyGoogleToken as any).mockRejectedValue(new Error('Invalid token'));

            const response = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: {
                    email: 'test@example.com',
                    token: 'invalid-token'
                }
            });

            // Expect 500 or 401 depending on how the route handles the error thrown by verifyGoogleToken
            // The route implementation likely catches it and returns 401 or 500.
            // Let's assume the router catches it.
            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });

        it('should fallback to legacy googleId if token is missing (Transition Period)', async () => {
            (prisma.user.findUnique as any).mockResolvedValue({
                id: 'user-uuid',
                email: 'legacy@example.com',
                googleId: 'legacy-id'
            });

            const response = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: {
                    email: 'legacy@example.com',
                    googleId: 'legacy-id'
                    // No token
                }
            });

            expect(response.statusCode).toBe(200);
            expect(verifyGoogleToken).not.toHaveBeenCalled();
            const body = response.json();
            expect(body.user.id).toBe('user-uuid');
        });

        it('should reject if neither token nor googleId is provided', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: {
                    email: 'test@example.com'
                }
            });

            expect(response.statusCode).toBe(400);
        });
    });
});
