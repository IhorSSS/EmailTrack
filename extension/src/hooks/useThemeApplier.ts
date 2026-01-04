import { useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export const useThemeApplier = (theme: Theme) => {
    useEffect(() => {
        const applyTheme = (t: Theme) => {
            if (t === 'system') {
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            } else {
                document.documentElement.setAttribute('data-theme', t);
            }
        };

        applyTheme(theme);

        // Listen for system theme changes if in system mode
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme('system');

            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);
};
