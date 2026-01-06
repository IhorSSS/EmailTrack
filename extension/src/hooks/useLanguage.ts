import { useState, useEffect } from 'react';
import type { Language } from '../types/i18n';

const STORAGE_KEY = 'language';

export const useLanguage = () => {
    const [language, setLanguage] = useState<Language>('system');
    const [resolvedLanguage, setResolvedLanguage] = useState<'en' | 'uk'>('en');

    // Load saved language
    useEffect(() => {
        chrome.storage.sync.get([STORAGE_KEY], (result) => {
            if (result[STORAGE_KEY]) {
                setLanguage(result[STORAGE_KEY] as Language);
            }
        });
    }, []);

    // Save language on change
    const updateLanguage = (lang: Language) => {
        setLanguage(lang);
        chrome.storage.sync.set({ [STORAGE_KEY]: lang });
    };

    // Resolve effective language
    useEffect(() => {
        if (language === 'system') {
            const browserLang = navigator.language.split('-')[0].toLowerCase(); // 'en-US' -> 'en'
            if (browserLang === 'uk') {
                setResolvedLanguage('uk');
            } else {
                setResolvedLanguage('en'); // Default fallback
            }
        } else {
            setResolvedLanguage(language as 'en' | 'uk');
        }
    }, [language]);

    // specific effect to update html tag
    useEffect(() => {
        document.documentElement.lang = resolvedLanguage;
    }, [resolvedLanguage]);

    return {
        language,
        setLanguage: updateLanguage,
        resolvedLanguage
    };
};
