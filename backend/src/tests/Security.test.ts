import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB to prevent connection attempts
vi.mock('../db', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
            create: vi.fn()
        }
    },
}));

import { buildApp } from '../app';

// Mock the auth utility
const verifyTokenMock = vi.fn();
vi.mock('../utils/auth', () => ({
    verifyGoogleToken: (token: string) => verifyTokenMock(token)
}));

describe('Auth Route Security', () => {
    let app: any;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('POST /auth/sync should reject requests without Authorization header', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/sync',
            payload: {
                email: 'test@example.com',
                emails: []
            }
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({ error: 'Missing Authorization header' });
    });

    it('POST /auth/sync should reject requests with invalid token format', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/sync',
            headers: {
                Authorization: 'InvalidFormat'
            },
            payload: {
                email: 'test@example.com',
                emails: []
            }
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid Authorization header format' });
    });

    it('POST /auth/sync should reject requests with invalid token', async () => {
        verifyTokenMock.mockRejectedValue(new Error('Invalid token'));

        const response = await app.inject({
            method: 'POST',
            url: '/auth/sync',
            headers: {
                Authorization: 'Bearer invalid_token'
            },
            payload: {
                email: 'test@example.com',
                emails: []
            }
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid or expired token' });
    });

    it('POST /auth/check-conflicts should reject requests without token', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/auth/check-conflicts',
            payload: {
                emailIds: ['123']
            }
        });

        expect(response.statusCode).toBe(401);
    });

    // We skip the success case as it requires mocking the UserService/DB which is out of scope for this specific security check
    // logic is verified by unit tests of verifyGoogleToken if needed.
});
