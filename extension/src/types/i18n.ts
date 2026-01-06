import enMessages from '../../public/_locales/en/messages.json';

export type Language = 'en' | 'uk' | 'system';

export type TranslationKey = keyof typeof enMessages;

export interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: TranslationKey, params?: Record<string, string>) => string;
    resolvedLanguage: 'en' | 'uk';
}
