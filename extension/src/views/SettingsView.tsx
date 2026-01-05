import React from 'react';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { Badge } from '../components/common/Badge';
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
    return (
        <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
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
                    background: globalEnabled ? 'var(--color-primary-soft)' : 'transparent'
                }}>
                    <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Tracking is {globalEnabled ? 'ON' : 'OFF'}</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                            {globalEnabled ? 'Automatically inject tracking pixel into new emails' : 'No pixels will be added to your emails'}
                        </p>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
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
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Visual Indicator</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Show a minimalist icon in Gmail compose window when tracking is active.
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
                        label="Body Preview Length"
                        value={bodyPreviewLength}
                        onChange={(e) => handleBodyPreviewChange(Number(e.target.value))}
                        options={[
                            { value: '0', label: 'None' },
                            { value: '50', label: 'Short (50 chars)' },
                            { value: '100', label: 'Medium (100 chars)' },
                            { value: '200', label: 'Long (200 chars)' }
                        ]}
                    />
                    <Select
                        label="App Theme"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as any)}
                        options={[
                            { value: 'system', label: 'System Default' },
                            { value: 'light', label: 'Light' },
                            { value: 'dark', label: 'Dark' }
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
                        Active Identity
                    </h4>
                    {userProfile ? (
                        <Badge variant="success" dot>Signed In</Badge>
                    ) : (
                        <Badge variant="neutral">Anonymous Session</Badge>
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
                            {userProfile?.name || 'Guest Mode'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {userProfile
                                ? userProfile.email
                                : 'Tracking locally without cloud sync'}
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
                        ℹ️ <b>Note:</b> New emails sent in Guest Mode are anonymous and won't be synced to your account until you sign in.
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
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-danger-text)' }}>Danger Zone</h4>
                <p style={{ fontSize: '11px', color: 'var(--color-danger-text)', opacity: 0.8 }}>
                    Permanently delete tracking history from this device and the cloud (where applicable).
                </p>
                <Button
                    variant="danger"
                    fullWidth
                    size="sm"
                    onClick={openDeleteConfirm}
                    disabled={loading}
                    style={{ marginTop: 'var(--spacing-xs)' }}
                >
                    Clear Tracking Data
                </Button>
            </div>

            {/* Version Footer */}
            <div style={{
                textAlign: 'center',
                padding: 'var(--spacing-sm)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                opacity: 0.6,
                marginTop: 'auto'
            }}>
                EmailTrack v{__APP_VERSION__}
            </div>
        </div>
    );
};
