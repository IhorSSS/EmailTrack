import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './Button.module.css';

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
    className = '',
    style,
    disabled,
    ...props
}) => {
    const { t } = useTranslation();

    const variantClass = {
        primary: styles.primary,
        secondary: styles.secondary,
        outline: styles.outline,
        ghost: styles.ghost,
        danger: styles.danger,
    }[variant];

    const sizeClass = {
        sm: styles.sm,
        md: styles.md,
        lg: styles.lg,
    }[size];

    const classNames = [
        styles.button,
        variantClass,
        sizeClass,
        fullWidth ? styles.fullWidth : '',
        loading ? styles.loading : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            disabled={disabled || loading}
            className={classNames}
            style={style}
            {...props}
        >
            {loading ? (
                <span className="animate-pulse">{t('status_loading')}</span>
            ) : children}
        </button>
    );
};
