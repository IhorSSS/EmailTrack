import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
    value: string | number;
    label: string;
    icon?: React.ReactNode;
    variant?: 'primary' | 'success';
}

export const StatCard: React.FC<StatCardProps> = ({ value, label, icon, variant = 'primary' }) => {
    return (
        <div className={styles.card}>
            {icon && <div className={styles.icon}>{icon}</div>}
            <div 
                className={`${styles.value} ${variant === 'success' ? styles.colorSuccess : styles.colorPrimary}`}
            >
                {value}
            </div>
            <div className={styles.label}>
                {label}
            </div>
        </div>
    );
};
