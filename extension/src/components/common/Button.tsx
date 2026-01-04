import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    style,
    disabled,
    ...props
}) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'primary':
                return {
                    background: 'var(--color-primary)',
                    color: 'var(--text-on-primary)',
                    boxShadow: 'var(--shadow-sm)',
                };
            case 'secondary':
                return {
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                };
            case 'ghost':
                return {
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                };
            case 'danger':
                return {
                    background: 'var(--color-danger-bg)',
                    color: 'var(--color-danger-text)',
                    border: '1px solid var(--color-danger)',
                };
            default:
                return {};
        }
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return { padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '12px' };
            case 'md':
                return { padding: 'var(--spacing-sm) var(--spacing-lg)', fontSize: '13px' };
            case 'lg':
                return { padding: 'var(--spacing-md) var(--spacing-xl)', fontSize: '15px' };
            default:
                return {};
        }
    };

    return (
        <button
            disabled={disabled || loading}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                width: fullWidth ? '100%' : 'auto',
                transition: 'var(--transition-base)',
                opacity: (disabled || loading) ? 0.6 : 1,
                cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
                ...getVariantStyles(),
                ...getSizeStyles(),
                ...style as any,
            }}
            {...props}
        >
            {loading ? (
                <span className="animate-pulse">Loading...</span>
            ) : children}
        </button>
    );
};
