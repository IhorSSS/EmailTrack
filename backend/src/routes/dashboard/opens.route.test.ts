import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock DB with all needed models
vi.mock('../../db', () => ({
    prisma: {
        trackedEmail: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            count: vi.fn(),
            deleteMany: vi.fn(),
        },
        openEvent: {
            findMany: vi.fn(),
            count: vi.fn(),
            deleteMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

vi.mock('../../middleware/authMiddleware', () => ({
    authenticate: vi.fn(),
    getAuthenticatedUser: vi.fn().mockResolvedValue(null),
}));

import { buildApp } from '../../app';
import { prisma } from '../../db';
import { getAuthenticatedUser } from '../../middleware/authMiddleware';

describe('GET /dashboard/emails/:id/opens', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('should return paginated opens with total count', async () => {
        const mockOpens = [
            { id: 'open-1', openedAt: new Date(), location: 'Kyiv, UA', device: '{}', ip: '1.2.3.4' },
            { id: 'open-2', openedAt: new Date(), location: 'London, GB', device: '{}', ip: '5.6.7.8' },
        ];

        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: null,
            owner: null,
        });
        (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockOpens);
        (prisma.openEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/email-123/opens?page=1&limit=50',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data).toHaveLength(2);
        expect(body.total).toBe(100);
    });

    it('should apply correct skip/take for pagination', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: null,
            owner: null,
        });
        (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.openEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        await app.inject({
            method: 'GET',
            url: '/dashboard/emails/email-123/opens?page=3&limit=25',
        });

        expect(prisma.openEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 50, // (3-1) * 25
                take: 25,
            })
        );
    });

    it('should sort descending by default', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: null,
            owner: null,
        });
        (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.openEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        await app.inject({
            method: 'GET',
            url: '/dashboard/emails/email-123/opens?page=1&limit=50',
        });

        expect(prisma.openEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { openedAt: 'desc' },
            })
        );
    });

    it('should respect sort=asc parameter', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: null,
            owner: null,
        });
        (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.openEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        await app.inject({
            method: 'GET',
            url: '/dashboard/emails/email-123/opens?page=1&limit=50&sort=asc',
        });

        expect(prisma.openEvent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { openedAt: 'asc' },
            })
        );
    });

    it('should return 404 when email does not exist', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/nonexistent/opens',
        });

        expect(response.statusCode).toBe(404);
    });

    it('should return 403 when email is owned and user is not authenticated', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: 'owner-uuid',
            owner: { googleId: 'google-owner-123' },
        });
        (getAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/owned-email/opens',
        });

        expect(response.statusCode).toBe(403);
    });

    it('should return 403 when authenticated user does not match owner', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: 'owner-uuid',
            owner: { googleId: 'google-owner-123' },
        });
        (getAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
            googleId: 'google-different-456',
            email: 'hacker@example.com',
        });

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/owned-email/opens',
        });

        expect(response.statusCode).toBe(403);
    });

    it('should return 200 when authenticated user matches owner', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: 'owner-uuid',
            owner: { googleId: 'google-owner-123' },
        });
        (getAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
            googleId: 'google-owner-123',
            email: 'owner@example.com',
        });
        (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.openEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/owned-email/opens',
        });

        expect(response.statusCode).toBe(200);
    });

    it('should allow access to unowned emails without auth', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: null,
            owner: null,
        });
        (getAuthenticatedUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.openEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/public-email/opens',
        });

        expect(response.statusCode).toBe(200);
    });

    it('should reject invalid sort parameter', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/email-123/opens?sort=invalid',
        });

        expect(response.statusCode).toBe(400);
    });

    it('should enforce max limit of 100', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/dashboard/emails/email-123/opens?limit=200',
        });

        expect(response.statusCode).toBe(400);
    });

    it('should use strict select fields (no leaking sensitive data)', async () => {
        (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
            ownerId: null,
            owner: null,
        });
        (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.openEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        await app.inject({
            method: 'GET',
            url: '/dashboard/emails/email-123/opens',
        });

        const callArgs = (prisma.openEvent.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
        const select = callArgs.select;

        // Should include only safe fields
        expect(select.id).toBe(true);
        expect(select.openedAt).toBe(true);
        expect(select.location).toBe(true);
        expect(select.device).toBe(true);
        expect(select.ip).toBe(true);

        // Should NOT include userAgent (raw UA is sensitive)
        expect(select.userAgent).toBeUndefined();
    });
});
