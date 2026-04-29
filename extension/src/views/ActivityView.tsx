import React from 'react';
import { EmailItem } from '../components/activity/EmailItem';
import { FilterChip } from '../components/common/FilterChip';
import { Select } from '../components/common/Select';
import { Skeleton } from '../components/common/Skeleton';
import { Badge } from '../components/common/Badge';
import { ChevronDown, ChevronUp, ArrowDownNarrowWide, ArrowUpWideNarrow } from 'lucide-react';
import { usePersistentToggle } from '../hooks/usePersistentToggle';
import type { TrackedEmail } from '../types';
import { Virtuoso } from 'react-virtuoso';

interface ActivityViewProps {
    uniqueSenders: string[];
    senderFilter: string;
    setSenderFilter: (val: string) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    filterType: 'all' | 'opened' | 'unopened';
    setFilterType: (val: 'all' | 'opened' | 'unopened') => void;
    sortField: 'sent' | 'last_opened' | 'open_count';
    setSortField: (val: 'sent' | 'last_opened' | 'open_count') => void;
    sortDirection: 'asc' | 'desc';
    setSortDirection: (val: 'asc' | 'desc') => void;
    processedEmails: TrackedEmail[];
    onEmailClick: (email: TrackedEmail) => void;
    onDeleteClick?: (email: TrackedEmail) => void;
    loading: boolean;
}

import { useTranslation } from '../hooks/useTranslation';
import styles from './ActivityView.module.css';

export const ActivityView: React.FC<ActivityViewProps> = ({
    uniqueSenders,
    senderFilter,
    setSenderFilter,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    processedEmails,
    onEmailClick,
    onDeleteClick,
    loading
}) => {
    const { t } = useTranslation();
    const { value: isHeaderExpanded, toggle: toggleHeader } = usePersistentToggle('activity_header_expanded', true);

    return (
        <div className={styles.container}>
            {/* Header Content with Search and Filters */}
            <div className={`glass ${styles.header}`}>
                <div className={styles.headerTop}>
                    <div className={styles.leftGroup}>
                        {!loading && (
                            <Badge variant="primary" shape="pill" className={styles.counterBadge}>
                                {processedEmails.length}
                            </Badge>
                        )}
                        {loading && uniqueSenders.length === 0 ? (
                            <div className={styles.filterSelect}>
                                <Skeleton height={36} borderRadius="var(--radius-md)" />
                            </div>
                        ) : (
                            <div className={styles.filterSelect}>
                                <Select
                                    value={uniqueSenders.length <= 1 ? 'all' : senderFilter}
                                    onChange={(e) => setSenderFilter(e.target.value)}
                                    disabled={uniqueSenders.length <= 1}
                                    title={senderFilter === 'all' ? t('dashboard_filter_all_senders') : senderFilter}
                                    options={
                                        uniqueSenders.length > 0
                                            ? [
                                                  { value: 'all', label: t('dashboard_filter_all_senders') },
                                                  ...uniqueSenders.map(s => ({ value: s, label: s }))
                                              ]
                                            : [{ value: 'all', label: t('dashboard_no_senders') || 'No senders' }]
                                    }
                                />
                            </div>
                        )}
                    </div>

                    <div className={styles.headerActions}>
                        <div className={styles.sortControls}>
                            <Select
                                value={sortField}
                                onChange={(e) => setSortField(e.target.value as any)}
                                options={[
                                    { value: 'sent', label: t('activity_sort_sent') || 'Sent' },
                                    { value: 'last_opened', label: t('activity_sort_last_opened') || 'Last Opened' },
                                    { value: 'open_count', label: t('activity_sort_open_count') || 'Opens' }
                                ]}
                            />
                            <button
                                onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                                className={styles.directionButton}
                                title={sortDirection === 'desc' ? t('activity_sort_desc') || 'Descending' : t('activity_sort_asc') || 'Ascending'}
                            >
                                {sortDirection === 'desc' ? <ArrowDownNarrowWide size={16} /> : <ArrowUpWideNarrow size={16} />}
                            </button>
                        </div>
                        <button
                            onClick={toggleHeader}
                            className={styles.toggleButton}
                            title={isHeaderExpanded ? t('common_collapse') || 'Collapse' : t('common_expand') || 'Expand'}
                        >
                            {isHeaderExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>

                {/* Search Bar + Filters Row - Collapsible */}
                {isHeaderExpanded && (
                    <div className={`animate-fade-in ${styles.searchFiltersRow}`}>
                        <div className={styles.searchContainer}>
                            <input
                                type="text"
                                placeholder={t('activity_search_placeholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={styles.searchInput}
                            />
                            <div className={styles.searchIcon}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className={styles.clearSearch}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Filters */}
                        <div className={styles.filtersGroup}>
                            <div className={styles.filterChips}>
                                <FilterChip
                                    label={t('activity_filter_all')}
                                    active={filterType === 'all'}
                                    onClick={() => setFilterType('all')}
                                />
                                <FilterChip
                                    label={t('activity_filter_opened')}
                                    active={filterType === 'opened'}
                                    onClick={() => setFilterType('opened')}
                                />
                                <FilterChip
                                    label={t('activity_filter_unopened')}
                                    active={filterType === 'unopened'}
                                    onClick={() => setFilterType('unopened')}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Email List */}
            <div className={styles.mainContent}>
                {loading ? (
                    <>
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                        <Skeleton height={78} borderRadius="var(--radius-md)" />
                    </>
                ) : processedEmails.length === 0 ? (
                    <div className={styles.noResults}>
                        <div className={styles.noResultsIcon}>
                            🔍
                        </div>
                        <div>
                            <p className={styles.noResultsTitle}>
                                {t('activity_no_results_title')}
                            </p>
                            <p className={styles.noResultsDesc}>
                                {searchQuery ? t('activity_no_results_desc', { query: searchQuery }) : t('activity_no_results_desc_default')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <Virtuoso
                        data={processedEmails}
                        itemContent={(_index, email) => (
                            <div key={email.id} style={{ paddingBottom: 'var(--spacing-md)' }}>
                                <EmailItem
                                    email={email}
                                    onClick={() => onEmailClick(email)}
                                    onDelete={() => onDeleteClick?.(email)}
                                />
                            </div>
                        )}
                        style={{ height: '100%' }}
                    />
                )}
            </div>
        </div>
    );
};
