import React from 'react';
import { EmailItem } from '../components/activity/EmailItem';
import { FilterChip } from '../components/common/FilterChip';
import { Select } from '../components/common/Select';
import { Skeleton } from '../components/common/Skeleton';
import type { TrackedEmail } from '../types';

interface ActivityViewProps {
    uniqueSenders: string[];
    senderFilter: string;
    setSenderFilter: (val: string) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    filterType: 'all' | 'opened' | 'unopened';
    setFilterType: (val: any) => void;
    processedEmails: TrackedEmail[];
    onEmailClick: (email: TrackedEmail) => void;
    onDeleteClick?: (email: TrackedEmail) => void;
    loading: boolean;
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
    onEmailClick,
    onDeleteClick,
    loading
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header Content with Search and Filters */}
            <div className="glass" style={{
                padding: 'var(--spacing-lg)',
                background: 'var(--bg-header)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
                position: 'sticky',
                top: 0,
                zIndex: 40,
            }}>
                {/* Sender Select at the top */}
                {uniqueSenders.length > 1 && (
                    <Select
                        value={senderFilter}
                        onChange={(e) => setSenderFilter(e.target.value)}
                        options={[
                            { value: 'all', label: 'All Senders' },
                            ...uniqueSenders.map(s => ({ value: s, label: s }))
                        ]}
                    />
                )}

                {/* Search Bar + Filters Row - Fixed Height */}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', height: '36px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-sm) 32px var(--spacing-sm) 32px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none',
                                transition: 'var(--transition-base)',
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)',
                                    padding: '4px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'var(--transition-base)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <FilterChip
                            label="All"
                            active={filterType === 'all'}
                            onClick={() => setFilterType('all')}
                        />
                        <FilterChip
                            label="Opened"
                            active={filterType === 'opened'}
                            onClick={() => setFilterType('opened')}
                        />
                        <FilterChip
                            label="Unopened"
                            active={filterType === 'unopened'}
                            onClick={() => setFilterType('unopened')}
                        />
                    </div>
                </div>
            </div>

            {/* Email List */}
            <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {loading && processedEmails.length === 0 ? (
                    <>
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                    </>
                ) : processedEmails.length === 0 ? (
                    <div style={{
                        padding: 'var(--spacing-xl) var(--spacing-lg)',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)'
                    }}>
                        <div style={{
                            fontSize: '32px',
                            background: 'var(--bg-card-hover)',
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 'var(--spacing-xs)'
                        }}>
                            🔍
                        </div>
                        <div>
                            <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                                No results found
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {searchQuery ? `We couldn't find anything matching "${searchQuery}"` : "Try adjusting your filters to see more results"}
                            </p>
                        </div>
                    </div>
                ) : (
                    processedEmails.map(email => (
                        <EmailItem
                            key={email.id}
                            email={email}
                            onClick={() => onEmailClick(email)}
                            onDelete={() => onDeleteClick?.(email)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
