import React from 'react';
import styles from './TabButton.module.css';

interface TabButtonProps {
    label: string;
    icon: 'dashboard' | 'activity' | 'settings';
    active: boolean;
    onClick: () => void;
}

export const TabButton: React.FC<TabButtonProps> = ({ label, icon, active, onClick }) => {
    const renderIcon = () => {
        const props = {
            width: 20,
            height: 20,
            stroke: active ? 'var(--color-primary)' : 'var(--text-muted)',
            strokeWidth: 2.5,
            fill: active ? 'var(--color-primary-soft)' : 'none',
            style: { transition: 'var(--transition-base)' }
        };

        switch (icon) {
            case 'dashboard':
                return (
                    <svg viewBox="0 0 24 24" {...props}>
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                );
            case 'activity':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke={props.stroke} strokeWidth={props.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                );
            case 'settings':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke={props.stroke} strokeWidth={props.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                );
        }
    };

    return (
        <button
            onClick={onClick}
            className={`${styles.button} ${active ? styles.buttonActive : ''}`}
        >
            <div className={`${styles.iconWrapper} ${active ? styles.iconWrapperActive : ''}`}>
                {renderIcon()}
            </div>
            <span className={`${styles.label} ${active ? styles.labelActive : ''}`}>
                {label}
            </span>
            {active && (
                <div className={styles.activeIndicator} />
            )}
        </button>
    );
};

