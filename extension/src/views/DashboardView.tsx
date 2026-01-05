import React from 'react';
import { EmailItem } from '../components/activity/EmailItem';
import { StatCard } from '../components/dashboard/StatCard';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Skeleton } from '../components/common/Skeleton';
import { CONSTANTS } from '../config/constants';
import type { TrackedEmail } from '../types';

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
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Sticky Header with Sender Filter and Stats */}
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
                {/* Sender Filter */}
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

                {/* Stats Grid - Fixed Height Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', height: '36px' }}>
                    {loading && processedEmails.length === 0 ? (
                        <>
                            <Skeleton height={36} borderRadius="var(--radius-md)" />
                            <Skeleton height={36} borderRadius="var(--radius-md)" />
                        </>
                    ) : (
                        <>
                            <StatCard
                                value={stats.tracked}
                                label="Emails Tracked"
                                color="var(--color-primary)"
                            />
                            <StatCard
                                value={`${stats.rate}%`}
                                label="Open Rate"
                                color={stats.rate > 50 ? 'var(--color-success)' : 'var(--color-primary)'}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>

                {/* Error Display */}
                {error && (
                    <div style={{
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        background: 'var(--color-danger-bg)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '13px',
                        color: 'var(--color-danger-text)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        border: '1px solid var(--color-danger)',
                        lineHeight: 1.4
                    }}>
                        <span style={{ fontSize: '16px' }}>⚠️</span> {error}
                    </div>
                )}

                {/* Recent Activity */}
                <div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--spacing-sm)',
                        padding: '0 var(--spacing-xs)'
                    }}>
                        <h3 style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em',
                            textTransform: 'uppercase'
                        }}>
                            Recent Activity
                        </h3>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-sm)',
                        background: 'var(--bg-card)',
                        padding: loading && processedEmails.length === 0 ? 'var(--spacing-md)' : 'var(--spacing-xs)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-color)',
                    }}>
                        {loading && processedEmails.length === 0 ? (
                            <>
                                <Skeleton height={70} borderRadius="var(--radius-md)" />
                                <Skeleton height={70} borderRadius="var(--radius-md)" />
                                <Skeleton height={70} borderRadius="var(--radius-md)" />
                            </>
                        ) : processedEmails.length === 0 ? (
                            <div style={{
                                padding: 'var(--spacing-xl) var(--spacing-lg)',
                                textAlign: 'center',
                                fontSize: '13px',
                                color: 'var(--text-muted)'
                            }}>
                                No activity yet. Send an email to start tracking!
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
                    style={{ marginTop: 'var(--spacing-xs)' }}
                    disabled={loading && processedEmails.length === 0}
                >
                    View Full History
                </Button>
            </div>
        </div>
    );
};

