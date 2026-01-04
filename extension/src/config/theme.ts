/**
 * Design System / Theme Configuration
 * Single source of truth for all visual design tokens.
 * References CSS variables defined in index.css for theme-awareness.
 */

export const theme = {
    colors: {
        // Primary
        primary: 'var(--color-primary)',
        primaryHover: 'var(--color-primary-hover)',
        primarySoft: 'var(--color-primary-soft)',

        // States
        success: 'var(--color-success)',
        successBg: 'var(--color-success-bg)',
        successText: 'var(--color-success-text)',

        danger: 'var(--color-danger)',
        dangerBg: 'var(--color-danger-bg)',
        dangerText: 'var(--color-danger-text)',

        warning: 'var(--color-warning)',
        warningBg: 'var(--color-warning-bg)',
        warningText: 'var(--color-warning-text)',

        info: 'var(--color-primary)',
        infoBg: 'var(--color-primary-soft)',

        // Neutral/Surface
        background: 'var(--bg-app)',
        backgroundCard: 'var(--bg-card)',
        backgroundHeader: 'var(--bg-header)',

        text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
            onPrimary: 'var(--text-on-primary)',
        },

        border: 'var(--border-color)',
        borderHover: 'var(--border-color-hover)',
    },

    spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
    },

    borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
    },

    shadows: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
    },

    fonts: {
        family: 'var(--font-family)',
    },

    transitions: {
        base: 'var(--transition-base)',
    }
} as const;

export type Theme = typeof theme;

