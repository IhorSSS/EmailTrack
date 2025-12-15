/**
 * Design System / Theme Configuration
 * Single source of truth for all visual design tokens
 */

export const theme = {
    colors: {
        // Primary
        primary: '#6366f1',        // Indigo 500
        primaryDark: '#4f46e5',    // Indigo 600

        // Success
        success: '#34a853',        // Google green
        successDark: '#137333',    // Dark green
        successLight: '#dcfce7',   // Light green bg
        successBg: '#e6f4ea',      // Success background
        successText: '#166534',    // Success text

        // Info/Blue
        info: '#1a73e8',           // Google blue
        infoBg: '#e8f0fe',         // Light blue bg
        infoLight: '#eff6ff',      // Very light blue
        infoDark: '#1e40af',       // Dark blue

        // Danger/Error
        danger: '#dc2626',         // Red 600
        dangerLight: '#fecaca',    // Red 200

        // Neutral/Gray Scale
        gray50: '#f8fafc',         // Lightest
        gray100: '#f1f5f9',
        gray200: '#e2e8f0',
        gray300: '#cbd5e0',
        gray400: '#94a3b8',
        gray500: '#64748b',
        gray600: '#475569',
        gray700: '#334155',
        gray800: '#1e293b',
        gray900: '#0f172a',        // Darkest

        // Semantic colors
        background: '#f8fafc',
        backgroundCard: '#ffffff',
        backgroundAlt: '#fafafa',

        text: {
            primary: '#0f172a',
            secondary: '#64748b',
            muted: '#888888',
        },

        border: '#e2e8f0',

        // Component-specific
        badge: {
            opened: {
                bg: '#dcfce7',
                text: '#166534'
            },
            sent: {
                bg: '#f1f5f9',
                text: '#475569'
            }
        }
    },

    spacing: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        xxl: 24,
        xxxl: 32
    },

    borderRadius: {
        sm: 4,
        md: 6,
        lg: 8,
        xl: 12,
        xxl: 16,
        full: 9999
    },

    shadows: {
        none: 'none',
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 1px 3px rgba(0,0,0,0.1)',
        lg: '0 4px 6px rgba(0,0,0,0.07)',
        xl: '0 8px 24px rgba(0,0,0,0.15)',
        toggle: '0 1px 2px rgba(0,0,0,0.2)'
    },

    fonts: {
        family: "'Inter', -apple-system, sans-serif",
        sizes: {
            xs: 11,
            sm: 12,
            md: 13,
            base: 14,
            lg: 16,
            xl: 18,
            xxl: 20
        },
        weights: {
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
            extrabold: 800
        }
    },

    transitions: {
        fast: '0.1s',
        normal: '0.2s',
        slow: '0.3s'
    }
} as const;

// Type for the theme
export type Theme = typeof theme;

// Helper function to get spacing/size in px
export const px = (value: number) => `${value}px`;
