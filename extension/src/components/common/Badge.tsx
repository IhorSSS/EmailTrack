import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'success' | 'primary' | 'warning' | 'danger' | 'neutral';
export type BadgeShape = 'pill' | 'square';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    shape?: BadgeShape;
    className?: string;
    style?: React.CSSProperties;
    dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'neutral',
    shape = 'square',
    className = '',
    style = {},
    dot = false
}) => {
    return (
        <span
            className={`${styles.badge} ${styles[variant]} ${styles[shape]} ${className}`}
            style={style}
        >
            {dot && (
                <span className={styles.dot} />
            )}
            {children}
        </span>
    );
};
