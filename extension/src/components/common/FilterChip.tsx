import React from 'react';
import styles from './FilterChip.module.css';

interface FilterChipProps {
    label: string;
    active: boolean;
    onClick: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`${styles.chip} ${active ? styles.active : ''}`}
    >
        {label}
    </button>
);

