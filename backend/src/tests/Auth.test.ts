import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { prisma } from '../db';
import { AuthService } from '../services/AuthService';

// Mock AuthService BEFORE importing routes or building app
vi.mock('../services/AuthService', () => ({
    AuthService: {
        verifyGoogleToken: vi.fn()
    }
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

describe('Auth Routes', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    describe('POST /login', () => {
        it('should login successfully with a valid Google Token', async () => {
            // Mock token verification success
            (AuthService.verifyGoogleToken as any).mockResolvedValue({
                googleId: 'google-123',
                email: 'test@example.com'
            });

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
            expect(AuthService.verifyGoogleToken).toHaveBeenCalledWith('valid-token');
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
            (AuthService.verifyGoogleToken as any).mockRejectedValue(new Error('Invalid token'));

            const response = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: {
                    email: 'test@example.com',
                    token: 'invalid-token'
                }
            });

            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });

        it('should FAIL if token is missing (Secure Mode - Legacy Disabled)', async () => {
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

            expect(response.statusCode).toBe(400);
            expect(AuthService.verifyGoogleToken).not.toHaveBeenCalled();
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

