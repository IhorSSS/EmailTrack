import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { prisma } from '../../db';
import { AuthService } from '../../services/AuthService';

// Mock DB
vi.mock('../../db', () => ({
    prisma: {
        trackedEmail: {
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
    },
}));

// Mock AuthService
vi.mock('../../services/AuthService', () => ({
    AuthService: {
        verifyGoogleToken: vi.fn(),
    }
}));

describe('Stats Route', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('should return 200 for tracked email WITHOUT identity (Public Access Allowed via UUID)', async () => {
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

        expect(response.statusCode).toBe(200);
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

    it('should return 200 (Public Access) even if email is owned by another user', async () => {
        // Rationale: If you have the UUID (Proof of Knowledge), you can see the stats.
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: 'owned-id',
            owner: { googleId: 'other-user-uuid' },
            opens: []
        });

        (AuthService.verifyGoogleToken as any).mockResolvedValue({
            googleId: 'my-user-uuid',
            email: 'me@example.com'
        });

        const response = await app.inject({
            method: 'GET',
            url: '/stats/owned-id',
            headers: { authorization: 'Bearer valid-token' }
        });

        expect(response.statusCode).toBe(200);
    });

    it('should return 200 for unowned/incognito email even if requester is LOGGED IN', async () => {
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: 'incognito-id',
            user: 'me@example.com',
            ownerId: null, // Unowned
            opens: []
        });

        (AuthService.verifyGoogleToken as any).mockResolvedValue({
            googleId: 'my-id',
            email: 'me@example.com'
        });

        vi.mocked(prisma.user as any).findUnique.mockResolvedValue({ id: 'my-uuid' });

        const response = await app.inject({
            method: 'GET',
            url: '/stats/incognito-id',
            headers: { authorization: 'Bearer valid-token' }
        });

        expect(response.statusCode).toBe(200);
    });

    it('should return 200 for owned email if requester is the owner', async () => {
        const myId = 'my-id';
        const myUuid = 'my-uuid';
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: 'my-email-id',
            ownerId: myUuid,
            opens: []
        });

        (AuthService.verifyGoogleToken as any).mockResolvedValue({
            googleId: myId,
            email: 'me@example.com'
        });

        vi.mocked(prisma.user as any).findUnique.mockResolvedValue({ id: myUuid });

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

