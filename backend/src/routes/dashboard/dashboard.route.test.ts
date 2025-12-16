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
});
