import React from 'react';

interface TabButtonProps {
    label: string;
    icon: string; // Emoji or specific identifier
    active: boolean;
    onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ label, icon, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            flex: 1,
            padding: '8px'
        }}
    >
        <span style={{ fontSize: '18px' }}>{icon === 'list' ? '📋' : icon}</span>
        <span style={{ fontSize: '10px', fontWeight: 500 }}>{label}</span>
    </button>
);
