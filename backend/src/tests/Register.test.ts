import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../db';
import registerRoutes from '../routes/register';
import Fastify from 'fastify';

// Mock Prisma
const { mockCreate } = vi.hoisted(() => {
    return { mockCreate: vi.fn() };
});

vi.mock('../db', () => ({
    prisma: {
        trackedEmail: {
            create: mockCreate
        }
    }
}));


describe('POST /register', () => {
    let app: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = Fastify();
        app.register(registerRoutes);
        await app.ready();
    });

    it('should register email with full metadata (Authenticated/Legacy)', async () => {
        const payload = {
            id: 'test-uuid',
            subject: 'Test Subject',
            recipient: 'test@example.com',
            body: 'Hello world',
            user: 'sender@example.com'
        };

        mockCreate.mockResolvedValue(payload);

        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload
        });

        expect(response.statusCode).toBe(201);
        expect(mockCreate).toHaveBeenCalledWith({
            data: payload
        });
    });

    it('should register email with ONLY ID (Incognito Mode)', async () => {
        const payload = {
            id: 'anonymous-uuid'
        };

        // Return what would be created (nulls for others)
        mockCreate.mockResolvedValue({
            ...payload,
            subject: null,
            recipient: null,
            body: null,
            user: null
        });

        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload
        });

        expect(response.statusCode).toBe(201);
        expect(mockCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id: 'anonymous-uuid'
            })
        });
        const body = JSON.parse(response.body);
        expect(body.id).toBe('anonymous-uuid');
    });
});
