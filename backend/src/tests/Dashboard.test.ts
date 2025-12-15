import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../db';
import dashboardRoutes from '../routes/dashboard';
import Fastify from 'fastify';

// Mock Prisma
const { mockFindMany, mockCount, mockTransaction } = vi.hoisted(() => {
    return {
        mockFindMany: vi.fn(),
        mockCount: vi.fn(),
        mockTransaction: vi.fn()
    };
});

vi.mock('../db', () => ({
    prisma: {
        trackedEmail: {
            findMany: mockFindMany,
            count: mockCount,
            deleteMany: vi.fn()
        },
        openEvent: {
            deleteMany: vi.fn()
        },
        $transaction: mockTransaction
    }
}));

describe('Dashboard Routes', () => {
    let app: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = Fastify();
        app.register(dashboardRoutes);
        await app.ready();
    });

    describe('GET /', () => {
        it('should filter by user (Legacy/Incognito)', async () => {
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(0);

            const response = await app.inject({
                method: 'GET',
                url: '/?user=test@example.com'
            });

            expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { user: 'test@example.com' }
            }));
        });

        it('should filter by ownerId (Cloud Mode)', async () => {
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(0);

            const response = await app.inject({
                method: 'GET',
                url: '/?ownerId=master-uuid'
            });

            expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { ownerId: 'master-uuid' }
            }));
        });

        it('should filter by ownerId AND user (Multi-sender filtering)', async () => {
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(0);

            const response = await app.inject({
                method: 'GET',
                url: '/?ownerId=master-uuid&user=alias@example.com'
            });

            expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    ownerId: 'master-uuid',
                    user: 'alias@example.com'
                }
            }));
        });

        it('should filter by ID list (Hydration)', async () => {
            mockFindMany.mockResolvedValue([]);
            mockCount.mockResolvedValue(0);

            const response = await app.inject({
                method: 'GET',
                url: '/?ids=uuid1,uuid2'
            });

            expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    id: { in: ['uuid1', 'uuid2'] }
                }
            }));
        });
    });

    describe('DELETE /', () => {
        it('should require either user or ownerId', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/'
            });
            expect(response.statusCode).toBe(400);
        });

        it('should delete by user (Legacy)', async () => {
            mockTransaction.mockImplementation(async (cb) => {
                // Mock the transaction flow manually if needed, or just verify transaction called
                return cb({
                    trackedEmail: {
                        findMany: vi.fn().mockResolvedValue([{ id: '1' }]),
                        deleteMany: vi.fn().mockResolvedValue({ count: 1 })
                    },
                    openEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }
                });
            });

            const response = await app.inject({
                method: 'DELETE',
                url: '/?user=legacy@example.com'
            });

            expect(mockTransaction).toHaveBeenCalled();
            // Deep verification of transaction logic is complex with simple mocks, 
            // but we verified the logic flow in code.
            expect(response.statusCode).toBe(200);
        });
    });
});
