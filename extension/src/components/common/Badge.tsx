import React from 'react';

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
    const getVariantStyles = (): React.CSSProperties => {
        switch (variant) {
            case 'success':
                return {
                    backgroundColor: 'var(--color-success-bg)',
                    color: 'var(--color-success-text)',
                };
            case 'primary':
                return {
                    backgroundColor: 'var(--color-primary-soft)',
                    color: 'var(--color-primary)',
                };
            case 'warning':
                return {
                    backgroundColor: 'var(--color-warning-bg)',
                    color: 'var(--color-warning-text)',
                };
            case 'danger':
                return {
                    backgroundColor: 'var(--color-danger-bg)',
                    color: 'var(--color-danger-text)',
                };
            case 'neutral':
            default:
                return {
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                };
        }
    };

    return (
        <span
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRadius: shape === 'pill' ? 'var(--radius-full)' : 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                lineHeight: 1,
                ...getVariantStyles(),
                ...style
            }}
        >
            {dot && (
                <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'currentColor'
                }} />
            )}
            {children}
        </span>
    );
};
