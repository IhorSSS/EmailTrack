import type { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card = ({ children, className = '', onClick }: CardProps) => {
    return (
        <div
            onClick={onClick}
            style={{
                background: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                padding: 'var(--spacing-md)',
                ...((onClick) ? { cursor: 'pointer', transition: 'border-color 0.2s' } : {})
            }}
            className={className}
        >
            {children}
        </div>
    );
};
