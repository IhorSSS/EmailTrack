import React, { useEffect } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
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
    type = 'info',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    showCancel = true,
    onConfirm,
    onCancel,
    onClose,
    loading = false
}) => {
    const handleDismiss = onClose || onCancel;

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
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className={styles.body}>
                    {message}
                </div>
                <div className={styles.footer}>
                    {showCancel && (
                        <button
                            className={styles.cancelBtn}
                            onClick={onCancel}
                            disabled={loading}
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        className={`${styles.confirmBtn} ${styles[type]}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
