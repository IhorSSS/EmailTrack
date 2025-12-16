import React from 'react';
import { EmailItem } from '../components/activity/EmailItem';
import { FilterChip } from '../components/common/FilterChip';
import { theme } from '../config/theme';
import type { TrackedEmail } from '../types';

interface ActivityViewProps {
    uniqueSenders: string[];
    senderFilter: string;
    setSenderFilter: (val: string) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    filterType: 'all' | 'opened' | 'sent';
    setFilterType: (val: 'all' | 'opened' | 'sent') => void;
    processedEmails: TrackedEmail[];
    onEmailClick: (email: TrackedEmail) => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
    uniqueSenders,
    senderFilter,
    setSenderFilter,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    processedEmails,
    onEmailClick
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Search & Filter - Clean Container */}
            <div style={{
                padding: '12px',
                background: 'var(--color-bg)',
                borderBottom: '1px solid var(--color-border)' // Explicit separator below header ONLY
            }}>
                {/* Sender Filter - show only if multiple senders */}
                {uniqueSenders.length > 1 && (
                    <select
                        value={senderFilter}
                        onChange={(e) => setSenderFilter(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginBottom: '10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-text-main)',
                            fontSize: '13px'
                        }}
                    >
                        <option value="all">All Senders</option>
                        {uniqueSenders.map(sender => (
                            <option key={sender} value={sender}>{sender}</option>
                        ))}
                    </select>
                )}

                <input
                    type="text"
                    placeholder="Search subject, body, recipient..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input" // Use CSS class for styling
                    style={{ marginBottom: '10px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-card)', color: 'var(--color-text-main)' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                    <FilterChip label="All" active={filterType === 'all'} onClick={() => setFilterType('all')} />
                    <FilterChip label="Opened" active={filterType === 'opened'} onClick={() => setFilterType('opened')} />
                    <FilterChip label="Sent" active={filterType === 'sent'} onClick={() => setFilterType('sent')} />
                </div>
            </div>

            {/* List Container - No extra borders */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                {processedEmails.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: theme.colors.gray400 }}>
                        {searchQuery || senderFilter !== 'all' ? 'No matches found.' : 'No emails found.'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {processedEmails.map((email, index) => (
                            <div key={email.id} style={{
                                borderBottom: index === processedEmails.length - 1 ? 'none' : '1px solid var(--color-border)'
                            }}>
                                <EmailItem
                                    email={email}
                                    onClick={() => onEmailClick(email)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
