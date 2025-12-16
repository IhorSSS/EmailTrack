import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../db';
import registerRoutes from '../routes/register';
import Fastify from 'fastify';

// Mock Prisma
const { mockEmailUpsert, mockUserFindUnique } = vi.hoisted(() => {
    return {
        mockEmailUpsert: vi.fn(),
        mockUserFindUnique: vi.fn()
    };
});

vi.mock('../db', () => ({
    prisma: {
        trackedEmail: {
            upsert: mockEmailUpsert
        },
        user: {
            // Let's just use mockCreate for user.create as well?
            // Actually, best to separate.
        }
    }
}));

// Re-define hoisting carefully
// ... actually I'll just use inline setup or cleaner hoisting.



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

        mockEmailUpsert.mockResolvedValue(payload);
        mockUserFindUnique.mockResolvedValue({ id: 'sender-uuid', googleId: 'sender@example.com' }); // Mock existing user resolve for ownerId check? 
        // Logic checks ownerId AND user. If ownerId is null/undefined in payload, it skips user resolution.
        // In this test 'ownerId' is NOT sent in payload?
        // Payload has 'user': 'sender@example.com'.
        // Request body has { ...payload }. 
        // register route extracts { ownerId } from body.

        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload
        });

        expect(response.statusCode).toBe(201);
        expect(mockEmailUpsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
                id: 'test-uuid',
                user: 'sender@example.com'
            })
        }));
    });

    it('should register email with ONLY ID (Incognito Mode)', async () => {
        const payload = {
            id: 'anonymous-uuid'
        };

        // Return what would be created (nulls for others)
        mockEmailUpsert.mockResolvedValue({
            ...payload,
            subject: null,
            recipient: null,
            body: null,
            user: null,
            ownerId: null
        });

        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload
        });

        expect(response.statusCode).toBe(201);
        expect(mockEmailUpsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ id: 'anonymous-uuid' })
        }));
        const body = JSON.parse(response.body);
        expect(body.id).toBe('anonymous-uuid');
    });
});
