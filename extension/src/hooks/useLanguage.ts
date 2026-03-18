import { useState, useEffect, useMemo } from 'react';
import type { Language } from '../types/i18n';
import { CONSTANTS } from '../config/constants';

export const useLanguage = () => {
    const [language, setLanguage] = useState<Language>('system');

    // Load saved language
    useEffect(() => {
        chrome.storage.sync.get([CONSTANTS.STORAGE_KEYS.LANGUAGE], (result) => {
            if (result[CONSTANTS.STORAGE_KEYS.LANGUAGE]) {
                setLanguage(result[CONSTANTS.STORAGE_KEYS.LANGUAGE] as Language);
            }
        });
    }, []);

    // Save language on change
    const updateLanguage = (lang: Language) => {
        setLanguage(lang);
        chrome.storage.sync.set({ [CONSTANTS.STORAGE_KEYS.LANGUAGE]: lang });
    };

    // Resolve effective language
    const resolvedLanguage = useMemo(() => {
        if (language === 'system') {
            const browserLang = navigator.language.split('-')[0].toLowerCase(); // 'en-US' -> 'en'
            return browserLang === 'uk' ? 'uk' : 'en';
        }
        return language as 'en' | 'uk';
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
