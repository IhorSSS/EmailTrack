import type { ReactNode } from 'react';
import { theme } from '../../config/theme';

interface CardProps {
    children: ReactNode;
}

export const Card = ({ children }: CardProps) => {
    return (
        <div
            style={{
                padding: '12px',
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                boxShadow: theme.shadows.sm,
            }}
        >
            {children}
        </div>
    );
};
