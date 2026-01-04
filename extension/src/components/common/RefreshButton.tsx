import React from 'react';

interface RefreshButtonProps {
    onClick: () => void;
    loading: boolean;
    size?: number;
    title?: string;
    style?: React.CSSProperties;
    className?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
    onClick,
    loading,
    size = 18,
    title = "Refresh",
    style,
    className
}) => {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={className}
            style={{
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                color: loading ? 'var(--color-primary)' : 'var(--text-secondary)',
                transition: 'var(--transition-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: loading ? 'var(--bg-app)' : 'transparent',
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                ...style
            }}
            onMouseEnter={(e) => {
                if (!loading) {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                }
            }}
            onMouseLeave={(e) => {
                if (!loading) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                }
            }}
            title={title}
        >
            <svg
                width={size} height={size} viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: loading ? 'rotate(360deg)' : 'none'
                }}
            >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
        </button>
    );
};
