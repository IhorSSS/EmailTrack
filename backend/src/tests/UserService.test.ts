import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../services/UserService';
import { prisma } from '../db';

// Mock the prisma client
vi.mock('../db', () => ({
    prisma: {
        user: {
            create: vi.fn(),
            upsert: vi.fn(),
            findUnique: vi.fn(),
        },
        trackedEmail: {
            update: vi.fn()
        }
    }
}));

describe('UserService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a user', async () => {
        const mockUser = {
            id: '123',
            email: 'test@example.com',
            googleId: 'google-123',
            createdAt: new Date()
        };

        (prisma.user.upsert as any).mockResolvedValue(mockUser);

        const result = await UserService.createOrUpdate('test@example.com', 'google-123');

        expect(prisma.user.upsert).toHaveBeenCalledWith({
            where: { googleId: 'google-123' },
            update: { email: 'test@example.com' },
            create: {
                email: 'test@example.com',
                googleId: 'google-123'
            }
        });
        expect(result).toEqual(mockUser);
    });

    it('should find user by email', async () => {
        const mockUser = {
            id: '123',
            email: 'test@example.com',
            createdAt: new Date(),
            googleId: null
        };

        (prisma.user.findUnique as any).mockResolvedValue(mockUser);

        const result = await UserService.findByEmail('test@example.com');

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'test@example.com' }
        });
        expect(result).toEqual(mockUser);
    });
});
