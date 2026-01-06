import type { UserProfile } from '../../services/AuthService';
import { Button } from '../common/Button';
import { RefreshButton } from '../common/RefreshButton';
import { useTranslation } from '../../hooks/useTranslation';

interface HeaderProps {
    onRefresh: () => void;
    loading: boolean;
    userProfile: UserProfile | null;
    onLogin: () => void;
    onLogout: () => void;
}

export const Header = ({ onRefresh, loading, userProfile, onLogin, onLogout }: HeaderProps) => {
    const { t } = useTranslation();

    return (
        <header className="glass" style={{
            height: 'var(--header-height)',
            padding: '0 var(--spacing-lg)',
            background: 'var(--bg-header)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 50,
            position: 'sticky',
            top: 0,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <img src="/icon.png" alt={t('app_name')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <h1 style={{
                    fontSize: '17px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em'
                }}>
                    {t('app_name')}
                </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshButton
                    onClick={onRefresh}
                    loading={loading}
                />

                <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }}></div>

                {userProfile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                            src={userProfile.picture}
                            alt={userProfile.name}
                            title={t('header_signed_in_as', { email: userProfile.email })}
                            style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: 'var(--radius-full)',
                                border: '2px solid var(--border-color)',
                                objectFit: 'cover'
                            }}
                        />
                        <button
                            onClick={onLogout}
                            style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                transition: 'var(--transition-base)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                        >
                            {t('header_logout')}
                        </button>
                    </div>
                ) : (
                    <Button
                        size="sm"
                        onClick={onLogin}
                    >
                        {t('header_login')}
                    </Button>
                )}
            </div>
        </header>
    );
};

