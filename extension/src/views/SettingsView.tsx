import React from 'react';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Badge } from '../components/common/Badge';
import { useTranslation } from '../hooks/useTranslation';
import type { UserProfile } from '../services/AuthService';

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
        <div style={{ padding: 'var(--spacing-lg) var(--spacing-lg) var(--spacing-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', minHeight: '100%' }}>
            {/* Tracking Toggle Section */}
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
            }}>
                <div style={{
                    padding: 'var(--spacing-lg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)',
                    background: globalEnabled ? 'var(--color-primary-soft)' : 'transparent',
                    gap: '16px' // Add gap between text and toggle
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}> {/* Allow text to wrap and not push toggle */}
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{t('settings_tracking_on')}</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)', lineHeight: '1.4' }}>
                            {t('settings_tracking_desc_on')}
                        </p>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}> {/* Prevent toggle squishing */}
                        <input
                            type="checkbox"
                            checked={globalEnabled}
                            onChange={toggleGlobal}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: globalEnabled ? 'var(--color-primary)' : 'var(--border-color)',
                            transition: 'var(--transition-base)',
                            borderRadius: 'var(--radius-full)',
                        }}>
                            <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '20px', width: '20px',
                                left: globalEnabled ? '22px' : '2px',
                                bottom: '2px',
                                backgroundColor: 'var(--bg-card)',
                                transition: 'var(--transition-base)',
                                borderRadius: '50%',
                                boxShadow: 'var(--shadow-sm)'
                            }} />
                        </span>
                    </label>
                </div>

                {/* Visual Indicator Toggle */}
                <div style={{
                    padding: 'var(--spacing-lg)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)',
                    opacity: globalEnabled ? 1 : 0.5,
                    pointerEvents: globalEnabled ? 'auto' : 'none',
                    transition: 'opacity var(--transition-base)'
                }}>
                    <div style={{ flex: 1, paddingRight: 'var(--spacing-md)' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t('settings_visual_indicator')}</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {t('settings_visual_indicator_desc')}
                        </p>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px', cursor: globalEnabled ? 'pointer' : 'not-allowed' }}>
                        <input
                            type="checkbox"
                            disabled={!globalEnabled}
                            checked={showTrackingIndicator && globalEnabled}
                            onChange={(e) => setShowTrackingIndicator(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute',
                            cursor: 'inherit',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: (showTrackingIndicator && globalEnabled) ? 'var(--color-primary)' : 'var(--border-color)',
                            transition: 'var(--transition-base)',
                            borderRadius: 'var(--radius-full)',
                        }}>
                            <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '16px', width: '16px',
                                left: (showTrackingIndicator && globalEnabled) ? '22px' : '2px',
                                bottom: '2px',
                                backgroundColor: 'var(--bg-card)',
                                transition: 'var(--transition-base)',
                                borderRadius: '50%',
                                boxShadow: 'var(--shadow-sm)'
                            }} />
                        </span>
                    </label>
                </div>

                <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                    <Select
                        label={t('settings_language')}
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as any)}
                        options={[
                            { value: 'system', label: t('settings_language_system', { lang: navigator.language.split('-')[0] }) },
                            { value: 'en', label: t('settings_language_en') },
                            { value: 'uk', label: t('settings_language_uk') }
                        ]}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-8px' }}>
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
                        onChange={(e) => setTheme(e.target.value as any)}
                        options={[
                            { value: 'system', label: t('settings_theme_system') },
                            { value: 'light', label: t('settings_theme_light') },
                            { value: 'dark', label: t('settings_theme_dark') }
                        ]}
                    />
                </div>
            </div>

            {/* Identity Info */}
            <div style={{
                padding: 'var(--spacing-lg)',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t('settings_active_identity')}
                    </h4>
                    {userProfile ? (
                        <Badge variant="success" dot>{t('settings_signed_in')}</Badge>
                    ) : (
                        <Badge variant="neutral">{t('settings_guest_mode')}</Badge>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    {userProfile?.picture ? (
                        <img
                            src={userProfile.picture}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                border: '2px solid var(--border-color)',
                                padding: '2px'
                            }}
                            alt=""
                        />
                    ) : (
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'var(--bg-app)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                        }}>
                            👤
                        </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {userProfile?.name || t('settings_guest_mode')}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {userProfile
                                ? userProfile.email
                                : t('settings_guest_desc')}
                        </div>
                    </div>
                </div>

                {!userProfile && (
                    <div style={{
                        marginTop: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'var(--bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        borderLeft: '3px solid var(--text-muted)',
                        lineHeight: '1.4'
                    }}>
                        ℹ️ <b>{t('common_note')}</b> {t('settings_guest_warning')}
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div style={{
                padding: 'var(--spacing-lg)',
                background: 'var(--color-danger-bg)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-danger)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)'
            }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-danger-text)' }}>{t('settings_danger_zone')}</h4>
                <p style={{ fontSize: '11px', color: 'var(--color-danger-text)', opacity: 0.8 }}>
                    {t('settings_danger_desc')}
                </p>
                <Button
                    variant="danger"
                    fullWidth
                    size="sm"
                    onClick={openDeleteConfirm}
                    disabled={loading}
                    style={{ marginTop: 'var(--spacing-xs)' }}
                >
                    {t('settings_clear_data')}
                </Button>
            </div>

            {/* Version Footer */}
            <div style={{
                textAlign: 'center',
                fontSize: '10px',
                color: 'var(--text-muted)',
                opacity: 0.5,
                marginTop: 'auto'
            }}>
                EmailTrack v{__APP_VERSION__}
            </div>
        </div>
    );

};
