import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Mock the db module BEFORE importing app
vi.mock('../../db', () => ({
    prisma: {
        trackedEmail: {
            create: vi.fn(),
        },
    },
}));

import { buildApp } from '../../app';
import { prisma } from '../../db';

describe('Register Route', () => {
    let app: FastifyInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        app = buildApp();
    });

    it('should register a new email and return tracking ID', async () => {
        const mockId = '123-uuid';
        (prisma.trackedEmail.create as any).mockResolvedValue({
            id: mockId,
            subject: 'Hello',
            recipient: 'test@example.com',
            createdAt: new Date(),
        });

        const response = await app.inject({
            method: 'POST',
            url: '/register',
            payload: {
                subject: 'Hello',
                recipient: 'test@example.com',
            },
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            id: mockId,
            pixelUrl: expect.stringContaining(`/track/${mockId}`),
        });
    });

    it('should return 400 if payload is invalid (if we add validation)', async () => {
        // For now simplistic
    });
});
