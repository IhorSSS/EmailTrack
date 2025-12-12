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

import { buildApp } from '../../app';
import { prisma } from '../../db';

describe('Stats Route', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('should return stats for tracked email', async () => {
        const mockId = '123-stats-uuid';
        (prisma.trackedEmail.findUnique as any).mockResolvedValue({
            id: mockId,
            subject: 'Test Email',
            createdAt: new Date(),
            opens: [
                {
                    id: '1',
                    openedAt: new Date(),
                    ip: '1.2.3.4',
                    device: 'Chrome on Mac',
                    location: 'New York, US'
                }
            ]
        });

        const response = await app.inject({
            method: 'GET',
            url: `/stats/${mockId}`,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.id).toBe(mockId);
        expect(body.opens).toHaveLength(1);
        expect(body.opens[0].location).toBe('New York, US');
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
