import React from 'react';
import { EmailItem } from '../components/activity/EmailItem';
import { StatCard } from '../components/dashboard/StatCard';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Skeleton } from '../components/common/Skeleton';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { usePersistentToggle } from '../hooks/usePersistentToggle';
import { CONSTANTS } from '../config/constants';
import type { TrackedEmail } from '../types';
import styles from './DashboardView.module.css';

interface DashboardViewProps {
    stats: { tracked: number; opened: number; rate: number };
    loading: boolean;
    error: string | null;
    uniqueSenders: string[];
    senderFilter: string;
    setSenderFilter: (val: string) => void;
    processedEmails: TrackedEmail[];
    onEmailClick: (email: TrackedEmail) => void;
    onDeleteClick?: (email: TrackedEmail) => void;
    onViewAllClick: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
    stats,
    loading,
    error,
    uniqueSenders,
    senderFilter,
    setSenderFilter,
    processedEmails,
    onEmailClick,
    onDeleteClick,
    onViewAllClick
}) => {
    const { t } = useTranslation();
    const { value: isHeaderExpanded, toggle: toggleHeader } = usePersistentToggle('dashboard_header_expanded', true);

    return (
        <div className={styles.container}>
            {/* Sticky Header with Sender Filter and Stats */}
            <div className={`glass ${styles.header}`}>
                <div className={styles.headerTop}>
                    {/* Sender Filter */}
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

                    <button
                        onClick={toggleHeader}
                        className={styles.toggleButton}
                        title={isHeaderExpanded ? t('common_collapse') || 'Collapse' : t('common_expand') || 'Expand'}
                    >
                        {isHeaderExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>

                {/* Stats Grid - Collapsible */}
                {isHeaderExpanded && (
                    <div className={`animate-fade-in ${styles.statsGrid}`}>
                    {loading && processedEmails.length === 0 ? (
                        <>
                            <Skeleton height={36} borderRadius="var(--radius-md)" />
                            <Skeleton height={36} borderRadius="var(--radius-md)" />
                        </>
                    ) : (
                        <>
                            <StatCard
                                value={stats.tracked}
                                label={t('dashboard_tracked')}
                                variant="primary"
                            />
                            <StatCard
                                value={`${stats.rate}%`}
                                label={t('dashboard_open_rate')}
                                variant={stats.rate > 50 ? 'success' : 'primary'}
                            />
                        </>
                    )}
                </div>
                )}
            </div>

            {/* Main Content */}
            <div className={styles.mainContent}>

                {/* Error Display */}
                {error && (
                    <div className={styles.errorBox}>
                        <span className={styles.errorIcon}>⚠️</span> {error}
                    </div>
                )}

                {/* Recent Activity */}
                <div>
                    <div className={styles.recentActivityHeader}>
                        <h3 className={styles.recentActivityTitle}>
                            {t('dashboard_recent_activity')}
                        </h3>
                    </div>

                    <div 
                        className={`${styles.recentActivityList} ${loading && processedEmails.length === 0 ? styles.recentActivityListLoading : styles.recentActivityListReady}`} 
                    >
                        {loading && processedEmails.length === 0 ? (
                            <>
                                <Skeleton height={70} borderRadius="var(--radius-md)" />
                                <Skeleton height={70} borderRadius="var(--radius-md)" />
                                <Skeleton height={70} borderRadius="var(--radius-md)" />
                            </>
                        ) : processedEmails.length === 0 ? (
                            <div className={styles.noActivity}>
                                {t('dashboard_no_activity')}
                            </div>
                        ) : (
                            processedEmails.slice(0, CONSTANTS.DASHBOARD_RECENT_COUNT).map(email => (
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

                <Button
                    variant="secondary"
                    fullWidth
                    onClick={onViewAllClick}
                    className={styles.marginTopXs}
                    disabled={loading && processedEmails.length === 0}
                >
                    {t('dashboard_view_full_history')}
                </Button>
            </div>
        </div>
    );
};

