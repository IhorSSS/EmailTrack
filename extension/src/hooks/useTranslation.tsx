import React, { createContext, useContext, useMemo } from 'react';
import { useLanguage } from './useLanguage';
import type { TranslationKey, I18nContextType } from '../types/i18n';
import enMessagesRaw from '../../public/_locales/en/messages.json';
import ukMessagesRaw from '../../public/_locales/uk/messages.json';

// Flatten logic type
type RawMessages = Record<string, { message: string }>;
type FlatMessages = Record<string, string>;

// Helper to flatten chrome.i18n format
const flattenMessages = (raw: RawMessages): FlatMessages => {
    return Object.keys(raw).reduce((acc, key) => {
        acc[key] = raw[key].message;
        return acc;
    }, {} as FlatMessages);
};

// Pre-compute flattened messages
const messages = {
    en: flattenMessages(enMessagesRaw as RawMessages),
    uk: flattenMessages(ukMessagesRaw as RawMessages)
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { language, setLanguage, resolvedLanguage } = useLanguage();

    const t = useMemo(() => {
        return (key: TranslationKey, params?: Record<string, string>): string => {
            const currentMessages = messages[resolvedLanguage];
            let message = currentMessages[key] || messages['en'][key] || key;

            if (params) {
                Object.entries(params).forEach(([paramKey, paramValue]) => {
                    message = message.replace(`{${paramKey}}`, paramValue);
                });
            }

            return message;
        };
    }, [resolvedLanguage]);

    return (
        <I18nContext.Provider value={{ language, setLanguage, t, resolvedLanguage }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }
    return context;
};
