import { useState, useMemo } from 'react';
import type { TrackedEmail } from '../types';

export const useFilteredEmails = (emails: TrackedEmail[]) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'opened' | 'sent'>('all');
    const [senderFilter, setSenderFilter] = useState<string>('all');

    const uniqueSenders = useMemo(() => {
        const senders = new Set<string>();
        emails.forEach(e => {
            if (e.user) senders.add(e.user);
        });
        return Array.from(senders).sort();
    }, [emails]);

    const processedEmails = useMemo(() => {
        let filtered = emails;
        // Filter by Sender
        if (senderFilter !== 'all') {
            filtered = filtered.filter(e => e.user === senderFilter);
        }
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e =>
                (e.subject && e.subject.toLowerCase().includes(q)) ||
                (e.recipient && e.recipient.toLowerCase().includes(q)) ||
                (e.body && e.body.toLowerCase().includes(q))
            );
        }
        // Status Filter
        if (filterType === 'opened') {
            filtered = filtered.filter(e => e.openCount > 0);
        } else if (filterType === 'sent') {
            filtered = filtered.filter(e => e.openCount === 0);
        }
        return filtered;
    }, [emails, senderFilter, searchQuery, filterType]);

    return {
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        senderFilter,
        setSenderFilter,
        uniqueSenders,
        processedEmails
    };
};
