import React from 'react';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Badge } from '../components/common/Badge';
import { Toggle } from '../components/common/Toggle';
import { useTranslation } from '../hooks/useTranslation';
import type { UserProfile } from '../services/AuthService';
import styles from './SettingsView.module.css';

interface SettingsViewProps {
    globalEnabled: boolean;
    toggleGlobal: () => void;
    bodyPreviewLength: number;
    handleBodyPreviewChange: (length: number) => void;
    userProfile: UserProfile | null;
    loading: boolean;
    openDeleteConfirm: () => void;
    theme: 'light' | 'dark' | 'system';
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    showTrackingIndicator: boolean;
    setShowTrackingIndicator: (enabled: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    globalEnabled,
    toggleGlobal,
    bodyPreviewLength,
    handleBodyPreviewChange,
    userProfile,
    loading,
    openDeleteConfirm,
    theme,
    setTheme,
    showTrackingIndicator,
    setShowTrackingIndicator
}) => {
    const { t, language, setLanguage } = useTranslation();

    return (
        <div className={styles.container}>
            {/* Tracking Toggle Section */}
            <div className={styles.section}>
                <div className={`${styles.row} ${globalEnabled ? styles.highlighted : ''}`}>
                    <div className={styles.rowText}>
                        <h4 className={styles.rowTitle}>{t('settings_tracking_on')}</h4>
                        <p className={styles.rowDesc}>{t('settings_tracking_desc_on')}</p>
                    </div>
                    <Toggle checked={globalEnabled} onChange={toggleGlobal} />
                </div>

                {/* Visual Indicator Toggle */}
                <div className={`${styles.row} ${!globalEnabled ? styles.disabled : ''}`}>
                    <div className={styles.rowText}>
                        <h4 className={styles.rowTitle}>{t('settings_visual_indicator')}</h4>
                        <p className={styles.rowDesc}>{t('settings_visual_indicator_desc')}</p>
                    </div>
                    <Toggle 
                        checked={showTrackingIndicator && globalEnabled}
                        onChange={(val) => setShowTrackingIndicator(val)}
                        disabled={!globalEnabled}
                        size="sm"
                    />
                </div>

                <div className={styles.formGroup}>
                    <Select
                        label={t('settings_language')}
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as 'system' | 'en' | 'uk')}
                        options={[
                            { value: 'system', label: t('settings_language_system', { lang: navigator.language.split('-')[0] }) },
                            { value: 'en', label: t('settings_language_en') },
                            { value: 'uk', label: t('settings_language_uk') }
                        ]}
                    />
                    <div className={styles.formNote}>
                        {t('settings_language_note')}
                    </div>

                    <Select
                        label={t('settings_body_preview_length')}
                        value={bodyPreviewLength}
                        onChange={(e) => handleBodyPreviewChange(Number(e.target.value))}
                        options={[
                            { value: '0', label: t('settings_body_preview_none') },
                            { value: '50', label: t('settings_body_preview_short') },
                            { value: '100', label: t('settings_body_preview_medium') },
                            { value: '200', label: t('settings_body_preview_long') }
                        ]}
                    />
                    <Select
                        label={t('settings_theme')}
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
                        options={[
                            { value: 'system', label: t('settings_theme_system') },
                            { value: 'light', label: t('settings_theme_light') },
                            { value: 'dark', label: t('settings_theme_dark') }
                        ]}
                    />
                </div>
            </div>

            {/* Identity Info */}
            <div className={styles.identitySection}>
                <div className={styles.identityHeader}>
                    <h4 className={styles.identityTitle}>{t('settings_active_identity')}</h4>
                    {userProfile ? (
                        <Badge variant="success" dot>{t('settings_signed_in')}</Badge>
                    ) : (
                        <Badge variant="neutral">{t('settings_guest_mode')}</Badge>
                    )}
                </div>

                <div className={styles.profileRow}>
                    {userProfile?.picture ? (
                        <img src={userProfile.picture} className={styles.profileImage} alt="" />
                    ) : (
                        <div className={styles.profileInitials}>👤</div>
                    )}
                    <div className={styles.profileText}>
                        <div className={styles.profileName}>
                            {userProfile?.name || t('settings_guest_mode')}
                        </div>
                        <div className={styles.profileEmail}>
                            {userProfile ? userProfile.email : t('settings_guest_desc')}
                        </div>
                    </div>
                </div>

                {!userProfile && (
                    <div className={styles.guestWarning}>
                        ℹ️ <b>{t('common_note')}</b> {t('settings_guest_warning')}
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div className={styles.dangerSection}>
                <h4 className={styles.dangerTitle}>{t('settings_danger_zone')}</h4>
                <p className={styles.dangerDesc}>{t('settings_danger_desc')}</p>
                <div className={styles.dangerButtonWrapper}>
                    <Button variant="danger" fullWidth size="sm" onClick={openDeleteConfirm} disabled={loading}>
                        {t('settings_clear_data')}
                    </Button>
                </div>
            </div>

            {/* Version Footer */}
            <div className={styles.footer}>
                EmailTrack v{__APP_VERSION__}
            </div>
        </div>
    );
};
