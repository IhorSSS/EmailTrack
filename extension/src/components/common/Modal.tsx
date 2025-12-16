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
    loading = false
}) => {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) onCancel();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, loading, onCancel]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={`${styles.modal} ${styles[type]}`}>
                <div className={styles.header}>
                    <h3 className={styles.title}>{title}</h3>
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
