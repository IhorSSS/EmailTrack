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
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
            flex: 1,
            minHeight: '36px',
        }}>
            {icon && <div>{icon}</div>}
            <div style={{
                fontSize: '16px',
                fontWeight: 800,
                color: color,
                lineHeight: 1,
            }}>
                {value}
            </div>
            <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
            }}>
                {label}
            </div>
        </div>
    );
};
