import { useState, useEffect } from 'react';

export interface ExtensionSettings {
    currentUser: string | null;
    setCurrentUser: (user: string | null) => void;
    globalEnabled: boolean;
    toggleGlobal: () => void;
    bodyPreviewLength: number;
    setBodyPreviewLength: (length: number) => void;
}

export function useExtensionSettings(): ExtensionSettings {
    const [currentUser, setCurrentUser] = useState<string | null>(null);
    const [globalEnabled, setGlobalEnabled] = useState(true);
    const [bodyPreviewLength, setBodyPreviewLength] = useState(0);

    // Initial Load
    useEffect(() => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            // Load Local (CurrentUser)
            if (chrome.storage.local) {
                chrome.storage.local.get(['currentUser'], (result: { currentUser?: string }) => {
                    if (result.currentUser) {
                        setCurrentUser(result.currentUser);
                    }
                });
            }
            // Load Sync (Settings)
            if (chrome.storage.sync) {
                chrome.storage.sync.get(['trackingEnabled', 'bodyPreviewLength'], (result: { trackingEnabled?: boolean; bodyPreviewLength?: number }) => {
                    if (result.trackingEnabled !== undefined) {
                        setGlobalEnabled(result.trackingEnabled);
                    }
                    if (result.bodyPreviewLength !== undefined) {
                        setBodyPreviewLength(result.bodyPreviewLength);
                    }
                });
            }
        }
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

    return {
        currentUser,
        setCurrentUser,
        globalEnabled,
        toggleGlobal,
        bodyPreviewLength,
        setBodyPreviewLength: handleBodyPreviewChange
    };
}
