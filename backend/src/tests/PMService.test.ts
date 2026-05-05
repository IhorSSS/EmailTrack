import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PMService } from '../services/PMService';
import { prisma } from '../db';
import { UserService } from '../services/UserService';

vi.mock('../db', () => ({
    prisma: {
        trackedEmail: {
            upsert: vi.fn(),
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        }
    },
}));

vi.mock('../services/UserService', () => ({
    UserService: {
        resolveUserFromAuth: vi.fn()
    }
}));

describe('PMService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('registerEmail', () => {
        it('should upsert email data', async () => {
            (UserService.resolveUserFromAuth as any).mockResolvedValue('user-uuid');
            (prisma.trackedEmail.upsert as any).mockResolvedValue({ id: 'track-1' });

            const data = {
                id: 'track-1',
                subject: 'Hello',
                recipient: 'test@test.com',
                user: 'sender@test.com'
            };

            await PMService.registerEmail(data, { googleId: 'g1', email: 'sender@test.com' });

            expect(prisma.trackedEmail.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'track-1' }
            }));
        });

        it('should throw FORBIDDEN_OWNERSHIP if hijacking is detected', async () => {
            (UserService.resolveUserFromAuth as any).mockResolvedValue('attacker-uuid');
            (prisma.trackedEmail.findUnique as any).mockResolvedValue({ ownerId: 'victim-uuid' });

            const data = { id: 'existing-id', subject: 'Spam' };

            await expect(PMService.registerEmail(data, { googleId: 'attacker', email: 'a@t.k' }))
                .rejects.toThrow('FORBIDDEN_OWNERSHIP');
        });
    });

    describe('isEmailOwnedByAnother', () => {
        it('should return true if owned by someone else', async () => {
            (prisma.trackedEmail.findUnique as any).mockResolvedValue({ ownerId: 'other-uuid' });
            const result = await PMService.isEmailOwnedByAnother('id', 'my-uuid');
            expect(result).toBe(true);
        });

        it('should return false if owned by requester', async () => {
            (prisma.trackedEmail.findUnique as any).mockResolvedValue({ ownerId: 'my-uuid' });
            const result = await PMService.isEmailOwnedByAnother('id', 'my-uuid');
            expect(result).toBe(false);
        });

        it('should return false if no owner', async () => {
            (prisma.trackedEmail.findUnique as any).mockResolvedValue({ ownerId: null });
            const result = await PMService.isEmailOwnedByAnother('id', 'my-uuid');
            expect(result).toBe(false);
        });
    });
});
