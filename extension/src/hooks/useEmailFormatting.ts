import { useMemo } from 'react';
import { useTranslation } from './useTranslation';
import { formatRecipient, formatDateTime, formatFullDate } from '../utils/formatter';
import type { TranslationKey } from '../types/i18n';

/**
 * useEmailFormatting - Headless Hook for localized email data formatting.
 * Encapsulates the logic for locale detection and binds it to formatting utilities.
 */
export const useEmailFormatting = () => {
    const { language, t } = useTranslation();

    // Map internal language state ('en', 'uk', 'system') to BCP 47 locale
    const currentLocale = useMemo(() => {
        if (language === 'system') return navigator.language;
        const localeMap: Record<string, string> = {
            'en': 'en-US',
            'uk': 'uk-UA'
        };
        return localeMap[language] || 'en-US';
    }, [language]);

    return useMemo(() => ({
        formatRecipient: (recipient: string) => 
            formatRecipient(recipient, t as (key: TranslationKey, params?: Record<string, string>) => string),
        
        formatDateTime: (dateStr: string) => 
            formatDateTime(dateStr, currentLocale),
            
        formatFullDate: (dateStr: string) => 
            formatFullDate(dateStr, currentLocale),
            
        currentLocale
    }), [currentLocale, t]);
};
