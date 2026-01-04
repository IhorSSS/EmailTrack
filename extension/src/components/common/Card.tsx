import type { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
}

export const Card = ({ children }: CardProps) => {
    return (
        <div
            style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
            }}
        >
            {children}
        </div>
    );
};
