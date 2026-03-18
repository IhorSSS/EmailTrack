import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

export function usePersistentToggle(key: string, defaultValue: boolean = true) {
    const [value, setValue] = useState<boolean>(defaultValue);
    const [isLoaded, setIsLoaded] = useState<boolean>(false);

    useEffect(() => {
        const loadValue = () => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([key], (result) => {
                    if (chrome.runtime.lastError) {
                        logger.error(`[usePersistentToggle] Error loading ${key}:`, chrome.runtime.lastError);
                        setIsLoaded(true);
                        return;
                    }
                    if (result[key] !== undefined) {
                        setValue(Boolean(result[key]));
                    }
                    setIsLoaded(true);
                });
            } else {
                setIsLoaded(true);
            }
        };

        loadValue();
    }, [key]);

    const toggle = useCallback(() => {
        setValue((prev) => {
            const newValue = !prev;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [key]: newValue }, () => {
                   if (chrome.runtime.lastError) {
                       logger.error(`[usePersistentToggle] Error saving ${key}:`, chrome.runtime.lastError);
                   }
                });
            }
            return newValue;
        });
    }, [key]);

    return { value, toggle, isLoaded };
}
