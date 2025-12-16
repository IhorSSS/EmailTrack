import React from 'react';
import { EmailItem } from '../components/activity/EmailItem';
import { Card } from '../components/common/Card';
import { theme } from '../config/theme';
import { CONSTANTS } from '../config/constants';
import type { TrackedEmail } from '../types';

interface DashboardViewProps {
    stats: { tracked: number; opened: number; rate: number };
    error: string | null;
    uniqueSenders: string[];
    senderFilter: string;
    setSenderFilter: (val: string) => void;
    processedEmails: TrackedEmail[];
    onEmailClick: (email: TrackedEmail) => void;
    onViewAllClick: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
    stats,
    error,
    uniqueSenders,
    senderFilter,
    setSenderFilter,
    processedEmails,
    onEmailClick,
    onViewAllClick
}) => {
    return (
        <div style={{ padding: '12px' }}>
            {/* Sender Filter for Dashboard Scope - show only if multiple senders */}
            {uniqueSenders.length > 1 && (
                <div style={{ marginBottom: '12px' }}>
                    <select
                        value={senderFilter}
                        onChange={(e) => setSenderFilter(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
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
                </div>
            )}

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <Card>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-primary)' }}>{stats.tracked}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                        Emails Tracked
                    </div>
                </Card>
                <Card>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: stats.rate > 50 ? theme.colors.successText : theme.colors.primary }}>
                        {stats.rate}%
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                        Open Rate
                    </div>
                </Card>
            </div>

            {/* Error Display */}
            {error && (
                <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: theme.colors.dangerLight,
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    color: theme.colors.danger,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: `1px solid ${theme.colors.danger}`
                }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Recent Activity Preview */}
            <div style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Recent Activity</h3>
                <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    {processedEmails.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: theme.colors.gray400 }}>No activity yet.</div>
                    ) : (
                        processedEmails.slice(0, CONSTANTS.DASHBOARD_RECENT_COUNT).map(email => (
                            <EmailItem
                                key={email.id}
                                email={email}
                                onClick={() => onEmailClick(email)}
                            />
                        ))
                    )}
                </div>
            </div>

            <button
                onClick={onViewAllClick}
                style={{
                    width: '100%', padding: '12px', background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                    fontWeight: 500, cursor: 'pointer', color: 'var(--color-primary)'
                }}
            >
                View All Activity
            </button>
        </div>
    );
};
