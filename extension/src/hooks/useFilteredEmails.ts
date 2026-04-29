import { useState, useMemo } from 'react';
import type { TrackedEmail } from '../types';

export const useFilteredEmails = (emails: TrackedEmail[]) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'opened' | 'unopened'>('all');
    const [senderFilter, setSenderFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<'sent' | 'last_opened' | 'open_count'>('sent');
    const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

    const uniqueSenders = useMemo(() => {
        const senders = new Set<string>();
        emails.forEach(e => {
            if (e.user) senders.add(e.user);
        });
        return Array.from(senders).sort();
    }, [emails]);

    const senderFilteredEmails = useMemo(() => {
        if (senderFilter === 'all') {
            return emails;
        }
        return emails.filter(e => e.user === senderFilter);
    }, [emails, senderFilter]);

    const processedEmails = useMemo(() => {
        let filtered = senderFilteredEmails;
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

        // Sorting
        filtered = [...filtered].sort((a, b) => {
            const multiplier = sortDirection === 'desc' ? 1 : -1;

            if (sortField === 'open_count') {
                if (b.openCount !== a.openCount) {
                    return (b.openCount - a.openCount) * multiplier;
                }
                // Fallback to sent time if open counts are equal
                return (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * multiplier;
            }
            
            if (sortField === 'last_opened') {
                const getLatestOpenTime = (email: TrackedEmail) => {
                    if (!email.opens || email.opens.length === 0) return 0;
                    // Find the max timestamp among opens
                    return Math.max(...email.opens.map(o => {
                        const ts = o.openedAt || o.timestamp;
                        return ts ? new Date(ts).getTime() : 0;
                    }));
                };
                
                const aTime = getLatestOpenTime(a);
                const bTime = getLatestOpenTime(b);
                
                if (aTime !== bTime) {
                    return (bTime - aTime) * multiplier;
                }
                // Fallback to sent time
                return (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * multiplier;
            }

            // Default: 'sent'
            return (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * multiplier;
        });

        return filtered;
    }, [senderFilteredEmails, searchQuery, filterType, sortField, sortDirection]);

    const stats = useMemo(() => {
        // Stats are usually calculated for the senderFilter context (ignoring search and status filter for dashboard-like feel)
        // However, the user request says: "Якщо пошта - all senders - показувати статистику по всім, якщо якась конкретна, то лише статистику по ній."
        // This implies statistics should react to the sender selector.

        const tracked = senderFilteredEmails.length;
        const opened = senderFilteredEmails.filter(e => e.openCount > 0).length;
        const rate = tracked > 0 ? Math.round((opened / tracked) * 100) : 0;

        return { tracked, opened, rate };
    }, [senderFilteredEmails]);

    return {
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        senderFilter,
        setSenderFilter,
        sortField,
        setSortField,
        sortDirection,
        setSortDirection,
        uniqueSenders,
        senderFilteredEmails,
        processedEmails,
        stats
    };
};

