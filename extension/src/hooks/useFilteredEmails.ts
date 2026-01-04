import { useState, useMemo } from 'react';
import type { TrackedEmail } from '../types';

export const useFilteredEmails = (emails: TrackedEmail[]) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'opened' | 'unopened'>('all');
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
        } else if (filterType === 'unopened') {
            filtered = filtered.filter(e => e.openCount === 0);
        }

        return filtered;
    }, [emails, senderFilter, searchQuery, filterType]);

    const stats = useMemo(() => {
        // Stats are usually calculated for the senderFilter context (ignoring search and status filter for dashboard-like feel)
        // However, the user request says: "Якщо пошта - all senders - показувати статистику по всім, якщо якась конкретна, то лише статистику по ній."
        // This implies statistics should react to the sender selector.

        const filteredBySender = senderFilter === 'all'
            ? emails
            : emails.filter(e => e.user === senderFilter);

        const tracked = filteredBySender.length;
        const opened = filteredBySender.filter(e => e.openCount > 0).length;
        const rate = tracked > 0 ? Math.round((opened / tracked) * 100) : 0;

        return { tracked, opened, rate };
    }, [emails, senderFilter]);

    return {
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        senderFilter,
        setSenderFilter,
        uniqueSenders,
        processedEmails,
        stats
    };
};

