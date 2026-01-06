import React, { useEffect } from 'react';
import styles from './Modal.module.css';
import { useTranslation } from '../../hooks/useTranslation';

interface ModalProps {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    children?: React.ReactNode;
    type?: 'danger' | 'info' | 'success' | 'warning';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    onClose?: () => void;
    loading?: boolean;
    showCancel?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    title,
    message,
    children,
    type = 'info',
    confirmLabel, // Removed default here
    cancelLabel, // Removed default here
    showCancel = true,
    onConfirm,
    onCancel,
    onClose,
    loading = false
}) => {
    const { t } = useTranslation();
    const handleDismiss = onClose || onCancel;

    // Use translations if props are not provided
    const finalConfirmLabel = confirmLabel || t('common_confirm');
    const finalCancelLabel = cancelLabel || t('common_cancel');

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) handleDismiss();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, loading, handleDismiss]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={`${styles.modal} ${styles[type]}`}>
                <div className={styles.header}>
                    <h3 className={styles.title}>{title}</h3>
                    <button
                        className={styles.closeBtn}
                        onClick={handleDismiss}
                        disabled={loading}
                        aria-label={t('common_close')}
                    >
                        ×
                    </button>
                </div>
                <div className={styles.body}>
                    <div className={styles.message}>{message}</div>
                    {children}
                </div>
                <div className={styles.footer}>
                    {showCancel && (
                        <button
                            className={styles.cancelBtn}
                            onClick={onCancel}
                            disabled={loading}
                        >
                            {finalCancelLabel}
                        </button>
                    )}
                    <button
                        className={`${styles.confirmBtn} ${styles[type]}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? t('common_processing') : finalConfirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
