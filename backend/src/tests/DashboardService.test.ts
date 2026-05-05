import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../services/DashboardService';
import { prisma } from '../db';

vi.mock('../db', () => ({
    prisma: {
        trackedEmail: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            count: vi.fn(),
        },
        openEvent: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        }
    },
}));

describe('DashboardService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getDashboardData', () => {
        it('should resolve owner UUID if ownerId is provided', async () => {
            const mockUser = { id: 'uuid-123', googleId: 'google-123' };
            (prisma.user.findUnique as any).mockResolvedValue(mockUser);
            (prisma.trackedEmail.findMany as any).mockResolvedValue([]);
            (prisma.trackedEmail.count as any).mockResolvedValue(0);

            await DashboardService.getDashboardData({
                page: 1,
                limit: 10,
                ownerId: 'google-123'
            }, { googleId: 'google-123', email: 'test@test.com' });

            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { googleId: 'google-123' } });
            expect(prisma.trackedEmail.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ ownerId: 'uuid-123' })
            }));
        });

        it('should throw FORBIDDEN_ACCESS if ownerId does not match authInfo', async () => {
            await expect(DashboardService.getDashboardData({
                page: 1,
                limit: 10,
                ownerId: 'google-123'
            }, { googleId: 'different-id', email: 'test@test.com' }))
            .rejects.toThrow('FORBIDDEN_ACCESS');
        });
    });

    describe('getEmailOpens', () => {
        it('should throw NOT_FOUND if email does not exist', async () => {
            (prisma.trackedEmail.findUnique as any).mockResolvedValue(null);

            await expect(DashboardService.getEmailOpens('invalid-id', 0, 10, null))
                .rejects.toThrow('NOT_FOUND');
        });

        it('should throw FORBIDDEN_ACCESS if email is owned by someone else', async () => {
            (prisma.trackedEmail.findUnique as any).mockResolvedValue({
                id: 'email-1',
                ownerId: 'owner-uuid',
                owner: { googleId: 'owner-google-id' }
            });

            await expect(DashboardService.getEmailOpens('email-1', 0, 10, { googleId: 'hacker-id', email: 'h@ck.er' }))
                .rejects.toThrow('FORBIDDEN_ACCESS');
        });

        it('should return opens data if authorized', async () => {
            (prisma.trackedEmail.findUnique as any).mockResolvedValue({
                id: 'email-1',
                ownerId: 'owner-uuid',
                owner: { googleId: 'owner-id' }
            });

            const mockOpens = [{ id: 'o1', openedAt: new Date() }];
            (prisma.openEvent.findMany as any).mockResolvedValue(mockOpens);
            (prisma.openEvent.count as any).mockResolvedValue(1);

            const result = await DashboardService.getEmailOpens('email-1', 0, 10, { googleId: 'owner-id', email: 'o@wn.er' });

            expect(result.data).toEqual(mockOpens);
            expect(result.total).toBe(1);
        });
    });
});
