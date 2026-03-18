import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './RefreshButton.module.css';

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
    title,
    style,
    className
}) => {
    const { t } = useTranslation();
    const finalTitle = title || t('common_refresh');

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`${className || ''} ${styles.button} ${loading ? styles.buttonLoading : styles.buttonReady}`}
            style={style}
            title={finalTitle}
        >
            <svg
                width={size} height={size} viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`${styles.icon} ${loading ? styles.iconLoading : styles.iconReady}`}
            >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
        </button>
    );
};
