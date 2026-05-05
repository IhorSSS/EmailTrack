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
            update: vi.fn(),
        },
        trackedEmail: {
            findMany: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(),
    }
}));

describe('UserService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should resolve user from auth (find by googleId)', async () => {
        (prisma.user.findUnique as any).mockResolvedValue({ id: 'uuid-1', googleId: 'g-1' });

        const result = await UserService.resolveUserFromAuth('g-1', 'test@test.com');

        expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { googleId: 'g-1' } });
        expect(result).toBe('uuid-1');
    });

    it('should link existing user by email if googleId matches', async () => {
        (prisma.user.findUnique as any)
            .mockResolvedValueOnce(null) // Not found by googleId
            .mockResolvedValueOnce({ id: 'uuid-1', email: 'test@test.com', googleId: null }); // Found by email

        (prisma.user.update as any).mockResolvedValue({ id: 'uuid-1', googleId: 'g-1' });

        const result = await UserService.resolveUserFromAuth('g-1', 'test@test.com');

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'uuid-1' },
            data: { googleId: 'g-1' }
        });
        expect(result).toBe('uuid-1');
    });

    describe('batchLinkEmails', () => {
        it('should throw if conflict detected', async () => {
            (prisma.trackedEmail.findMany as any).mockResolvedValue([{ id: 'conflicted', ownerId: 'other-user' }]);

            await expect(UserService.batchLinkEmails('my-user', [{ id: 'conflicted' }]))
                .rejects.toThrow('Ownership Conflict');
        });

        it('should upsert emails in a transaction', async () => {
            (prisma.trackedEmail.findMany as any).mockResolvedValue([]);
            (prisma.$transaction as any) = vi.fn().mockImplementation(p => Promise.all(p));
            (prisma.trackedEmail.upsert as any).mockResolvedValue({});

            await UserService.batchLinkEmails('user-1', [{ id: 'e1', subject: 'Hello' }]);

            expect(prisma.trackedEmail.upsert).toHaveBeenCalled();
            expect(prisma.$transaction).toHaveBeenCalled();
        });
    });

    describe('hasOwnershipConflict', () => {
        it('should return true if any email belongs to another google account', async () => {
            (prisma.trackedEmail.findMany as any).mockResolvedValue([
                { id: '1', owner: { googleId: 'someone-else' } }
            ]);

            const conflict = await UserService.hasOwnershipConflict(['1'], 'me');
            expect(conflict).toBe(true);
        });

        it('should return false if owned by same user', async () => {
            (prisma.trackedEmail.findMany as any).mockResolvedValue([
                { id: '1', owner: { googleId: 'me' } }
            ]);

            const conflict = await UserService.hasOwnershipConflict(['1'], 'me');
            expect(conflict).toBe(false);
        });
    });
});
