import React from 'react';

interface FilterChipProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: active ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            background: active ? 'var(--color-primary)' : 'var(--bg-card)',
            color: active ? 'var(--text-on-primary)' : 'var(--text-secondary)',
            transition: 'var(--transition-base)',
            boxShadow: active ? 'var(--shadow-sm)' : 'none',
        }}
    >
        {label}
    </button>
);

