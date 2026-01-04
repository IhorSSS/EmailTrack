import React from 'react';

interface StatCardProps {
    value: string | number;
    label: string;
    icon?: React.ReactNode;
    color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ value, label, icon, color = 'var(--color-primary)' }) => {
    return (
        <div style={{
            background: 'var(--bg-card)',
            padding: 'var(--spacing-lg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            transition: 'var(--transition-base)',
            cursor: 'default',
        }}>
            {icon && <div style={{ marginBottom: 'var(--spacing-sm)' }}>{icon}</div>}
            <div style={{
                fontSize: '24px',
                fontWeight: 800,
                color: color,
                lineHeight: 1,
                marginBottom: 'var(--spacing-xs)'
            }}>
                {value}
            </div>
            <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                {label}
            </div>
        </div>
    );
};
