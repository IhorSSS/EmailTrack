import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock DB
vi.mock('../../db', () => ({
    prisma: {
        trackedEmail: {
            findUnique: vi.fn(),
        },
    },
}));

// Mock Auth
vi.mock('../../utils/auth', () => ({
    verifyGoogleToken: vi.fn(),
}));

import { buildApp } from '../../app';
import { prisma } from '../../db';
import { verifyGoogleToken } from '../../utils/auth';

describe('Stats Route', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('should return 404 for tracked email WITHOUT identity (Public Access Restricted)', async () => {
        const mockId = '123-stats-uuid';
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: mockId,
            subject: 'Test Email',
            user: 'sender@example.com',
            owner: null,
            createdAt: new Date(),
            opens: []
        });

        const response = await app.inject({
            method: 'GET',
            url: `/stats/${mockId}`,
        });

        expect(response.statusCode).toBe(404);
    });

    it('should return 200 for tracked email WITH x-sender-hint', async () => {
        const mockId = '123-stats-uuid';
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: mockId,
            user: 'sender@example.com',
            owner: null,
            opens: [
                {
                    openedAt: new Date(),
                    device: 'Chrome',
                    location: 'Local'
                }
            ]
        });

        const response = await app.inject({
            method: 'GET',
            url: `/stats/${mockId}`,
            headers: {
                'x-sender-hint': 'sender@example.com'
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().id).toBe(mockId);
    });

    it('should return 404 if email is owned by another user', async () => {
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: 'owned-id',
            owner: { googleId: 'other-user-uuid' },
            opens: []
        });

        (verifyGoogleToken as any).mockResolvedValue({
            googleId: 'my-user-uuid',
            email: 'me@example.com'
        });

        const response = await app.inject({
            method: 'GET',
            url: '/stats/owned-id',
            headers: { authorization: 'Bearer valid-token' }
        });

        expect(response.statusCode).toBe(404);
    });

    it('should return 404 if incognito email belongs to another sender (when logged in)', async () => {
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: 'incognito-id',
            user: 'someone-else@example.com',
            owner: null,
            opens: []
        });

        (verifyGoogleToken as any).mockResolvedValue({
            googleId: 'my-id',
            email: 'me@example.com'
        });

        const response = await app.inject({
            method: 'GET',
            url: '/stats/incognito-id',
            headers: { authorization: 'Bearer valid-token' }
        });

        expect(response.statusCode).toBe(404);
    });

    it('should return 200 for incognito email if sender matches (case insensitive)', async () => {
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: 'incognito-match-id',
            user: 'Me@Example.com', // Stored with mixed case
            owner: null,
            opens: []
        });

        (verifyGoogleToken as any).mockResolvedValue({
            googleId: 'my-id',
            email: 'me@example.com' // Token is lower case
        });

        const response = await app.inject({
            method: 'GET',
            url: '/stats/incognito-match-id',
            headers: { authorization: 'Bearer valid-token' }
        });

        expect(response.statusCode).toBe(200);
    });

    it('should return 200 for owned email if requester is the owner', async () => {
        const myId = 'my-id';
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: 'my-email-id',
            owner: { googleId: myId },
            opens: []
        });

        (verifyGoogleToken as any).mockResolvedValue({
            googleId: myId,
            email: 'me@example.com'
        });

        const response = await app.inject({
            method: 'GET',
            url: '/stats/my-email-id',
            headers: { authorization: 'Bearer valid-token' }
        });

        expect(response.statusCode).toBe(200);
    });

    it('should return 404 if email not found', async () => {
        (prisma.trackedEmail.findUnique as any).mockResolvedValue(null);

        const response = await app.inject({
            method: 'GET',
            url: '/stats/not-found',
        });

        expect(response.statusCode).toBe(404);
    });
});
