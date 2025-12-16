import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Modal } from '../components/common/Modal';
import { theme } from '../config/theme';
import type { UserProfile } from '../services/AuthService';

interface SettingsViewProps {
    globalEnabled: boolean;
    toggleGlobal: () => void;
    bodyPreviewLength: number;
    handleBodyPreviewChange: (val: number) => void;
    userProfile: UserProfile | null;
    senderFilter: string;
    loading: boolean;
    activeIdentity: string | null;
    onDeleteHistory: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    globalEnabled,
    toggleGlobal,
    bodyPreviewLength,
    handleBodyPreviewChange,
    userProfile,
    senderFilter,
    loading,
    activeIdentity,
    onDeleteHistory
}) => {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleConfirmDelete = async () => {
        await onDeleteHistory();
        setIsDeleteModalOpen(false);
    };

    return (
        <div style={{ padding: 'var(--spacing-md)' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h4 style={{ fontSize: '15px', fontWeight: 500 }}>Global Tracking</h4>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                            Auto-inject pixel into new emails
                        </p>
                    </div>
                    <div
                        onClick={toggleGlobal}
                        style={{
                            width: '44px', height: '24px', background: globalEnabled ? theme.colors.primary : theme.colors.gray200,
                            borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
                        }}
                    >
                        <div style={{
                            width: '20px', height: '20px', background: 'white', borderRadius: '50%',
                            position: 'absolute', top: '2px', left: globalEnabled ? '22px' : '2px',
                            transition: 'left 0.3s', boxShadow: theme.shadows.toggle
                        }} />
                    </div>
                </div>
            </Card>

            <div style={{ marginTop: '20px' }}>
                <h4 style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Email Body Preview</h4>
                <Card>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Save Content Preview</h4>
                                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
                                    Store email content for easier identification in tracking history
                                </p>
                            </div>
                        </div>

                        <select
                            value={bodyPreviewLength}
                            onChange={(e) => handleBodyPreviewChange(Number(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                fontSize: '13px',
                                background: 'var(--color-bg-card)',
                                color: 'var(--color-text-main)',
                                cursor: 'pointer'
                            }}
                        >
                            <option value={0}>Disabled (Recommended for privacy)</option>
                            <option value={50}>50 characters</option>
                            <option value={100}>100 characters</option>
                            <option value={150}>150 characters</option>
                            <option value={200}>200 characters</option>
                            <option value={-1}>Full email</option>
                        </select>

                        {bodyPreviewLength !== 0 && (
                            <div style={{
                                marginTop: '12px',
                                padding: '8px 12px',
                                background: theme.colors.infoLight,
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '11px',
                                color: theme.colors.infoDark,
                                display: 'flex',
                                gap: '6px',
                                alignItems: 'flex-start'
                            }}>
                                <span>ℹ️</span>
                                <span>Email content will be stored on your tracking server. We recommend keeping this disabled for sensitive communications.</span>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div style={{ marginTop: '20px' }}>
                <h4 style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px', textTransform: 'uppercase' }}>Danger Zone</h4>
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: '#ef4444' }}>Delete History</span>
                            <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px', margin: 0 }}>
                                {userProfile
                                    ? `Permanently delete all tracking data for account ${userProfile.email}`
                                    : senderFilter !== 'all'
                                        ? `Delete tracking data for sender: ${senderFilter}`
                                        : 'Delete all local tracking history'
                                }
                            </p>
                        </div>
                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            disabled={loading || (!userProfile && !activeIdentity && senderFilter === 'all')}
                            style={{
                                fontSize: '11px',
                                color: theme.colors.danger,
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${theme.colors.danger}`,
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: (loading || (!userProfile && !activeIdentity && senderFilter === 'all')) ? 'not-allowed' : 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Delete {senderFilter !== 'all' && !userProfile ? 'Sender' : 'All'}
                        </button>
                    </div>
                </Card>
            </div>

            <Modal
                isOpen={isDeleteModalOpen}
                title="Delete Tracking History"
                message={
                    <span>
                        {userProfile ? (
                            <>
                                Are you sure you want to <b>DELETE ALL</b> tracking history for cloud account <b>{userProfile.email}</b>?
                            </>
                        ) : senderFilter !== 'all' ? (
                            <>
                                Are you sure you want to delete all tracking history for sender <b>{senderFilter}</b>?
                                <br /><br />
                                <i style={{ fontSize: '10px' }}>Other senders' history will remain intact.</i>
                            </>
                        ) : (
                            <>
                                Are you sure you want to <b>DELETE ALL</b> local tracking history?
                            </>
                        )}
                        <br /><br />
                        This action cannot be undone.
                    </span>
                }
                type="danger"
                confirmLabel="Delete Forever"
                onConfirm={handleConfirmDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
                loading={loading}
            />
        </div>
    );
};
