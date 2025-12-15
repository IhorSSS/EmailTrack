
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';

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

    it('should register a new email with user and body', async () => {
        const mockEmail = {
            id: '123',
            subject: 'Test Subject',
            recipient: 'test@example.com',
            body: 'Hello World',
            user: 'sender@example.com',
        };

        (prisma.trackedEmail.create as any).mockResolvedValue(mockEmail);

        const response = await app.inject({
            method: 'POST',
            url: '/register',
            payload: {
                id: mockEmail.id,
                subject: mockEmail.subject,
                recipient: mockEmail.recipient,
                body: mockEmail.body,
                user: mockEmail.user
            },
        });

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.id).toBe('123');
        expect(body.pixelUrl).toContain('/track/123');

        expect(prisma.trackedEmail.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                id: '123',
                subject: 'Test Subject',
                recipient: 'test@example.com',
                body: 'Hello World',
                user: 'sender@example.com'
            })
        }));
    });
});
