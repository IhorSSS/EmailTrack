import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

vi.mock('../../db', () => ({
    prisma: {
        trackedEmail: {
            findMany: vi.fn(),
            count: vi.fn(),
            deleteMany: vi.fn(),
        },
        openEvent: {
            deleteMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        $transaction: vi.fn((callback) => callback({
            openEvent: { deleteMany: vi.fn() },
            trackedEmail: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) }
        })),
    },
}));

vi.mock('../../middleware/authMiddleware', () => ({
    authenticate: vi.fn(),
    getAuthenticatedUser: vi.fn().mockResolvedValue(null)
}));

import { buildApp } from '../../app';
import { prisma } from '../../db';
import { getAuthenticatedUser } from '../../middleware/authMiddleware';

describe('Dashboard Route', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('should return list of tracked emails', async () => {
        (prisma.trackedEmail.findMany as any).mockResolvedValue([
            {
                id: '1',
                subject: 'Sub 1',
                createdAt: new Date(),
                _count: { opens: 5 }
            }
        ]);
        (prisma.trackedEmail.count as any).mockResolvedValue(1);

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard?page=1&limit=10&user=test@example.com',
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data).toHaveLength(1);
        expect(body.total).toBe(1);
        expect(body.data[0]._count.opens).toBe(5);
    });
    it('should filter by user if provided', async () => {
        (prisma.trackedEmail.findMany as any).mockResolvedValue([
            { id: '1', user: 'test@example.com' }
        ]);
        (prisma.trackedEmail.count as any).mockResolvedValue(1);

        const response = await app.inject({
            method: 'GET',
            url: '/dashboard?user=test@example.com',
        });

        expect(response.statusCode).toBe(200);
        expect(prisma.trackedEmail.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                user: 'test@example.com',
                ownerId: null
            }
        }));
        expect(prisma.trackedEmail.count).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                user: 'test@example.com',
                ownerId: null
            }
        }));
    });

    describe('DELETE /dashboard', () => {
        it('should delete emails by IDs when ids param is provided', async () => {
            const mockDeleteOpenEvents = vi.fn();
            const mockDeleteEmails = vi.fn().mockResolvedValue({ count: 2 });
            const mockFindMany = vi.fn().mockResolvedValue([
                { id: 'id1', ownerId: null, user: 'test@example.com' },
                { id: 'id2', ownerId: null, user: 'test@example.com' }
            ]);

            (prisma.$transaction as any).mockImplementation(async (callback: any) => {
                return callback({
                    trackedEmail: {
                        findMany: mockFindMany,
                        deleteMany: mockDeleteEmails
                    },
                    openEvent: { deleteMany: mockDeleteOpenEvents }
                });
            });

            const response = await app.inject({
                method: 'DELETE',
                url: '/dashboard?ids=id1,id2',
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ success: true, count: 2 });
            expect(mockFindMany).toHaveBeenCalledWith({
                where: { id: { in: ['id1', 'id2'] } },
                select: { id: true, ownerId: true, user: true }
            });
            expect(mockDeleteOpenEvents).toHaveBeenCalledWith({
                where: { trackedEmailId: { in: ['id1', 'id2'] } }
            });
            expect(mockDeleteEmails).toHaveBeenCalledWith({
                where: { id: { in: ['id1', 'id2'] } }
            });
        });
    });

    describe('POST /dashboard/sync', () => {
        it('should return metadata for provided IDs and strictly exclude sensitive content', async () => {
            (prisma.trackedEmail.findMany as any).mockResolvedValue([
                { id: '1', ownerId: 'owner1', _count: { opens: 2 } }
            ]);

            const response = await app.inject({
                method: 'POST',
                url: '/dashboard/sync',
                payload: {
                    ids: ['1', '2']
                }
            });

            expect(response.statusCode).toBe(200);

            // Verify Prisma was called with STRICT select
            // Use manual call inspection to avoid objectContaining issues with undefined
            const callArgs = (prisma.trackedEmail.findMany as any).mock.calls[0][0];
            expect(callArgs.where).toEqual({ id: { in: ['1', '2'] } });

            // Validating select keys
            const select = callArgs.select;
            expect(select.id).toBe(true);
            expect(select.ownerId).toBe(true);

            // Crucial Security Checks:
            expect(select.body).toBeUndefined();
            expect(select.subject).toBeUndefined();
            expect(select.recipient).toBeUndefined();

            const body = response.json();
            expect(body.data).toHaveLength(1);
        });

        it('should validate max batch size', async () => {
            // Mock a large array
            const largeIds = new Array(1001).fill('id');
            const response = await app.inject({
                method: 'POST',
                url: '/dashboard/sync',
                payload: {
                    ids: largeIds
                }
            });
            expect(response.statusCode).toBe(400);
        });
    });

    describe('GET /dashboard Security', () => {
        it('should Use STRICT SELECT when anonymous (no ownerId)', async () => {
            // Mock unauthenticated
            (getAuthenticatedUser as any).mockResolvedValue(null);

            (prisma.trackedEmail.findMany as any).mockResolvedValue([]);
            (prisma.trackedEmail.count as any).mockResolvedValue(0);

            await app.inject({
                method: 'GET',
                url: '/dashboard?ids=1,2'
            });

            // Verify SELECT clause is used instead of INCLUDE
            expect(prisma.trackedEmail.findMany).toHaveBeenCalledWith(expect.objectContaining({
                // select must be present
                select: expect.objectContaining({
                    id: true,
                    _count: expect.any(Object),
                })
            }));

            // Verify we did NOT use 'include' (which returns everything by default)
            const callArgs = (prisma.trackedEmail.findMany as any).mock.calls[0][0];
            expect(callArgs.include).toBeUndefined();
            // And select should NOT have body
            expect(callArgs.select.body).toBeUndefined();
            expect(callArgs.select.subject).toBeUndefined();
        });

        it('should Allow FULL Access when Authenticated & Owner', async () => {
            // Mock Authenticated
            (getAuthenticatedUser as any).mockResolvedValue({ googleId: 'g1' });
            // Mock that the user exists/is resolved
            const mockUserFind = vi.fn().mockResolvedValue({ id: 'uuid-1', googleId: 'g1' });
            (prisma.user.findUnique as any) = mockUserFind;

            await app.inject({
                method: 'GET',
                url: '/dashboard?ownerId=g1&user=me@test.com'
            });

            // When authenticated, we use 'include' (or default select which includes everything)
            // In the implementation: `selectClause` is undefined if authenticated.
            const callArgs = (prisma.trackedEmail.findMany as any).mock.calls[0][0];
            expect(callArgs.select).toBeUndefined(); // Undefined means return all fields
            expect(callArgs.include).toBeDefined(); // We use include for relations (opens)
        });
    });
});
