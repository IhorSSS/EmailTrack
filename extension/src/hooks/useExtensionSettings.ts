import { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { CONSTANTS } from '../config/constants';
import { LocalStorageService } from '../services/LocalStorageService';

export interface ExtensionSettings {
    currentUser: string | null;
    setCurrentUser: (user: string | null) => void;
    globalEnabled: boolean;
    toggleGlobal: () => void;
    bodyPreviewLength: number;
    setBodyPreviewLength: (length: number) => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    showTrackingIndicator: boolean;
    setShowTrackingIndicator: (enabled: boolean) => void;
    settingsLoaded: boolean;
}

export function useExtensionSettings(): ExtensionSettings {
    const [currentUser, setLocalCurrentUser] = useState<string | null>(null);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [globalEnabled, setGlobalEnabled] = useState(true);
    const [bodyPreviewLength, setBodyPreviewLength] = useState(0);
    const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system');
    const [showTrackingIndicator, setShowTrackingIndicatorState] = useState(true);

    const setCurrentUser = async (user: string | null) => {
        setLocalCurrentUser(user);
        if (user) {
            await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.CURRENT_USER]: user });
        } else {
            // chrome.storage.local.remove([CONSTANTS.STORAGE_KEYS.CURRENT_USER]);
            // For now, identity is semi-local, but let's keep it in sync for simplicity
            const settings = await LocalStorageService.getSettings();
            const updatedSettings = { ...settings };
            delete updatedSettings[CONSTANTS.STORAGE_KEYS.CURRENT_USER];
            await LocalStorageService.updateSettings(updatedSettings);
        }
    };

    // Initial Load
    useEffect(() => {
        const loadSettings = async () => {
            logger.log('[useExtensionSettings] Starting settings load...');
            const settings = await LocalStorageService.getSettings();
            const profile = await LocalStorageService.getUserProfile();

            // Identity logic
            if (profile?.email) {
                setLocalCurrentUser(profile.email);
            } else if (typeof settings[CONSTANTS.STORAGE_KEYS.CURRENT_USER] === 'string') {
                setLocalCurrentUser(settings[CONSTANTS.STORAGE_KEYS.CURRENT_USER] as string);
            }

            if (typeof settings[CONSTANTS.STORAGE_KEYS.TRACKING_ENABLED] === 'boolean') {
                setGlobalEnabled(settings[CONSTANTS.STORAGE_KEYS.TRACKING_ENABLED] as boolean);
            }
            if (typeof settings[CONSTANTS.STORAGE_KEYS.SHOW_TRACKING_INDICATOR] === 'boolean') {
                setShowTrackingIndicatorState(settings[CONSTANTS.STORAGE_KEYS.SHOW_TRACKING_INDICATOR] as boolean);
            }
            if (typeof settings[CONSTANTS.STORAGE_KEYS.BODY_PREVIEW_LENGTH] === 'number') {
                setBodyPreviewLength(settings[CONSTANTS.STORAGE_KEYS.BODY_PREVIEW_LENGTH] as number);
            }
            if (typeof settings[CONSTANTS.STORAGE_KEYS.THEME] === 'string') {
                setThemeState(settings[CONSTANTS.STORAGE_KEYS.THEME] as 'light' | 'dark' | 'system');
            }

            logger.log('[useExtensionSettings] Settings loaded, setting settingsLoaded=true');
            setSettingsLoaded(true);
        };

        loadSettings();
    }, []);

    const toggleGlobal = async () => {
        const newValue = !globalEnabled;
        setGlobalEnabled(newValue);
        await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.TRACKING_ENABLED]: newValue });
    };

    const handleBodyPreviewChange = async (value: number) => {
        setBodyPreviewLength(value);
        await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.BODY_PREVIEW_LENGTH]: value });
    };

    const handleThemeChange = async (value: 'light' | 'dark' | 'system') => {
        setThemeState(value);
        await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.THEME]: value });
    };

    const handleShowTrackingIndicatorChange = async (value: boolean) => {
        setShowTrackingIndicatorState(value);
        await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.SHOW_TRACKING_INDICATOR]: value });
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
        showTrackingIndicator,
        setShowTrackingIndicator: handleShowTrackingIndicatorChange,
        settingsLoaded
    };
}
