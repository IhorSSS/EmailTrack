import { useState, useEffect } from 'react';

export interface ExtensionSettings {
    currentUser: string | null;
    setCurrentUser: (user: string | null) => void;
    globalEnabled: boolean;
    toggleGlobal: () => void;
    bodyPreviewLength: number;
    setBodyPreviewLength: (length: number) => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    settingsLoaded: boolean;
}

export function useExtensionSettings(): ExtensionSettings {
    const [currentUser, setLocalCurrentUser] = useState<string | null>(null);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [globalEnabled, setGlobalEnabled] = useState(true);
    const [bodyPreviewLength, setBodyPreviewLength] = useState(0);
    const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system');

    const setCurrentUser = (user: string | null) => {
        setLocalCurrentUser(user);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            if (user) {
                chrome.storage.local.set({ currentUser: user });
            } else {
                chrome.storage.local.remove('currentUser');
            }
        }
    };

    // Initial Load
    useEffect(() => {
        const loadSettings = async () => {
            console.log('[useExtensionSettings] Starting settings load...');
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const results = await new Promise<any>((resolve) => {
                    chrome.storage.local.get(['currentUser'], (res) => {
                        console.log('[useExtensionSettings] Loaded from storage:', res);
                        resolve(res);
                    });
                });

                if (results.currentUser) {
                    console.log('[useExtensionSettings] Setting currentUser to:', results.currentUser);
                    setLocalCurrentUser(results.currentUser);
                } else {
                    console.log('[useExtensionSettings] No currentUser in storage');
                }

                if (chrome.storage.sync) {
                    const syncResults = await new Promise<any>((resolve) => {
                        chrome.storage.sync.get(['trackingEnabled', 'bodyPreviewLength', 'theme'], (res) => resolve(res));
                    });

                    if (syncResults.trackingEnabled !== undefined) {
                        setGlobalEnabled(syncResults.trackingEnabled);
                    }
                    if (syncResults.bodyPreviewLength !== undefined) {
                        setBodyPreviewLength(syncResults.bodyPreviewLength);
                    }
                    if (syncResults.theme) {
                        setThemeState(syncResults.theme);
                    }
                }
            }
            console.log('[useExtensionSettings] Settings loaded, setting settingsLoaded=true');
            setSettingsLoaded(true);
        };

        loadSettings();
    }, []);

    const toggleGlobal = () => {
        setGlobalEnabled(prev => {
            const newValue = !prev;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ trackingEnabled: newValue });
            }
            return newValue;
        });
    };

    const handleBodyPreviewChange = (value: number) => {
        setBodyPreviewLength(value);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ bodyPreviewLength: value });
        }
    };

    const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
        setThemeState(value);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ theme: value });
        }
    };

    return {
        currentUser,
        setCurrentUser,
        globalEnabled,
        toggleGlobal,
        bodyPreviewLength,
        setBodyPreviewLength: handleBodyPreviewChange,
        theme,
        setTheme: handleThemeChange,
        settingsLoaded
    };
}
