import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

vi.mock('../../db', () => ({
    prisma: {
        trackedEmail: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

import { buildApp } from '../../app';
import { prisma } from '../../db';

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
            url: '/dashboard?page=1&limit=10',
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
            where: { user: 'test@example.com' }
        }));
        expect(prisma.trackedEmail.count).toHaveBeenCalledWith(expect.objectContaining({
            where: { user: 'test@example.com' }
        }));
    });
});
