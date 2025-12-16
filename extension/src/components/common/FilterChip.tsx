import React from 'react';
import { theme } from '../../config/theme';

interface FilterChipProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            padding: '4px 12px',
            borderRadius: '16px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            background: active ? theme.colors.primary : theme.colors.gray200,
            color: active ? 'white' : theme.colors.gray500,
            transition: 'all 0.2s'
        }}
    >
        {label}
    </button>
);
