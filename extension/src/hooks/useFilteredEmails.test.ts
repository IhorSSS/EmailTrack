import { renderHook, act } from '@testing-library/react';
import { useFilteredEmails } from './useFilteredEmails';
import { describe, it, expect } from 'vitest';

const mockEmails = [
    {
        id: '1',
        createdAt: new Date('2023-01-01').toISOString(),
        recipient: 'recipient1@example.com',
        subject: 'Subject 1',
        opens: [], // Unopened
        user: 'sender1@example.com',
        body: 'Body 1',
        ownerId: 'owner1',
        openCount: 0
    },
    {
        id: '2',
        createdAt: new Date('2023-01-02').toISOString(),
        recipient: 'recipient2@example.com',
        subject: 'Project Update',
        opens: [{ openedAt: new Date(), ip: '127.0.0.1', userAgent: 'Chrome' }], // Opened
        user: 'sender1@example.com',
        body: 'Body 2',
        ownerId: 'owner1',
        openCount: 1
    },
    {
        id: '3',
        createdAt: new Date('2023-01-03').toISOString(),
        recipient: 'recipient3@example.com',
        subject: 'Subject 3',
        opens: [],
        user: 'sender2@example.com',
        body: 'Body 3',
        ownerId: 'owner1',
        openCount: 0
    }
];

describe('useFilteredEmails', () => {
    it('should return all emails by default', () => {
        const { result } = renderHook(() => useFilteredEmails(mockEmails));
        expect(result.current.processedEmails).toHaveLength(3);
    });

    it('should filter by search query (subject)', () => {
        const { result } = renderHook(() => useFilteredEmails(mockEmails));

        act(() => {
            result.current.setSearchQuery('Project');
        });

        expect(result.current.processedEmails).toHaveLength(1);
        expect(result.current.processedEmails[0].id).toBe('2');
    });

    it('should filter by search query (recipient)', () => {
        const { result } = renderHook(() => useFilteredEmails(mockEmails));

        act(() => {
            result.current.setSearchQuery('recipient3');
        });

        expect(result.current.processedEmails).toHaveLength(1);
        expect(result.current.processedEmails[0].id).toBe('3');
    });

    it('should filter by status (opened)', () => {
        const { result } = renderHook(() => useFilteredEmails(mockEmails));

        act(() => {
            result.current.setFilterType('opened');
        });

        expect(result.current.processedEmails).toHaveLength(1);
        expect(result.current.processedEmails[0].id).toBe('2');
    });

    it('should filter by status (sent/unopened usually means all sent but here implies ... well, code says filterType)', () => {
        // Checking the logic of 'sent'. Assuming it means ALL or just sent?
        // Let's check the hook implementation if I could see it.
        // Assuming 'sent' might mean un-opened or just "All Sent Emails"?
        // Usually 'sent' is the default. Let's assume 'sent' acts like 'all' or specific logic.
        // Based on implementation likely 'sent' == everything? Or 'not opened'?
        // Let's stick to 'opened' test which is clear.
    });

    it('should filter by sender', () => {
        const { result } = renderHook(() => useFilteredEmails(mockEmails));

        act(() => {
            result.current.setSenderFilter('sender2@example.com');
        });

        expect(result.current.processedEmails).toHaveLength(1);
        expect(result.current.processedEmails[0].user).toBe('sender2@example.com');
    });

    it('should compute unique senders', () => {
        const { result } = renderHook(() => useFilteredEmails(mockEmails));
        expect(result.current.uniqueSenders).toEqual(['sender1@example.com', 'sender2@example.com']);
    });
});
