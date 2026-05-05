import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackerService } from '../services/TrackerService';

// Mock dependencies
vi.mock('../db', () => ({
    prisma: {
        openEvent: {
            findFirst: vi.fn(),
            create: vi.fn((args) => args),
        },
        trackedEmail: {
            findUnique: vi.fn(),
            create: vi.fn((args) => args),
            update: vi.fn((args) => args),
        },
        $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    },
}));

vi.mock('geoip-lite', () => ({
    default: {
        lookup: vi.fn().mockReturnValue({ city: 'Kyiv', country: 'UA' }),
    },
}));

import { prisma } from '../db';

describe('TrackerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('recordOpen', () => {
        it('should record an open event for existing email', async () => {
            (prisma.openEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
            (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
                id: 'track-123',
                subject: 'Test',
            });

            await TrackerService.recordOpen(
                'track-123',
                '1.2.3.4',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'
            );

            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should debounce duplicate events from same IP and UA', async () => {
            const recentEvent = {
                ip: '1.2.3.4',
                userAgent: 'Mozilla/5.0 Chrome/120',
                openedAt: new Date(), // Just now — within debounce window
            };
            (prisma.openEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(recentEvent);

            await TrackerService.recordOpen('track-123', '1.2.3.4', 'Mozilla/5.0 Chrome/120');

            // Should NOT create a new event
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('should not debounce events from different IPs', async () => {
            const recentEvent = {
                ip: '9.9.9.9', // Different IP
                userAgent: 'Mozilla/5.0 Chrome/120',
                openedAt: new Date(),
            };
            (prisma.openEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(recentEvent);
            (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
                id: 'track-123',
            });

            await TrackerService.recordOpen('track-123', '1.2.3.4', 'Mozilla/5.0 Chrome/120');

            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should lazy-register email if not found', async () => {
            (prisma.openEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
            (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
            (prisma.trackedEmail.create as ReturnType<typeof vi.fn>).mockResolvedValue({
                id: 'new-track',
            });

            await TrackerService.recordOpen('new-track', '1.2.3.4', 'Mozilla/5.0');

            expect(prisma.trackedEmail.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        id: 'new-track',
                    }),
                })
            );
        });

        it('should detect Gmail proxy bot', async () => {
            (prisma.openEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
            (prisma.trackedEmail.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
                id: 'track-123',
            });

            await TrackerService.recordOpen(
                'track-123',
                '66.249.93.1',
                'Mozilla/5.0 (Windows; U; Windows NT 5.1; de; rv:1.9.0.7) Gecko/2009021910 Firefox/3.0.7 (via GoogleImageProxy)'
            );

            expect(prisma.$transaction).toHaveBeenCalled();
            // Verify the device JSON contains bot info
            const transactionArgs = (prisma.$transaction as ReturnType<typeof vi.fn>).mock.calls[0][0];
            const createCall = transactionArgs[0];
            const deviceJson = JSON.parse(createCall.data.device);
            expect(deviceJson.isBot).toBe(true);
        });

        it('should handle DB errors gracefully without throwing', async () => {
            (prisma.openEvent.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('DB connection lost')
            );

            // Should NOT throw — errors are caught internally
            await expect(
                TrackerService.recordOpen('track-123', '1.2.3.4', 'Mozilla/5.0')
            ).resolves.toBeUndefined();
        });
    });
});
