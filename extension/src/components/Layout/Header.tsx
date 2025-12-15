
// React import removed

import type { UserProfile } from '../../services/AuthService';

interface HeaderProps {
    onRefresh: () => void;
    loading: boolean;
    userProfile: UserProfile | null;
    onLogin: () => void;
    onLogout: () => void;
}

export const Header = ({ onRefresh, loading, userProfile, onLogin, onLogout }: HeaderProps) => {
    return (
        <header style={{
            height: '56px',
            padding: '0 var(--spacing-md)',
            background: 'var(--color-bg-card)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '24px' }}>📨</div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    EmailTrack
                </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '8px',
                        cursor: loading ? 'wait' : 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-secondary)',
                        opacity: loading ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center'
                    }}
                    title="Refresh"
                >
                    <svg
                        width="20" height="20" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transition: 'transform 0.5s', transform: loading ? 'rotate(180deg)' : 'none' }}
                    >
                        <path d="M23 4v6h-6"></path>
                        <path d="M1 20v-6h6"></path>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>

                <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }}></div>

                {userProfile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                            src={userProfile.picture}
                            alt={userProfile.name}
                            title={`Signed in as ${userProfile.email}`}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--color-border)' }}
                        />
                        <button
                            onClick={onLogout}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '12px',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Sign out
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onLogin}
                        style={{
                            background: 'var(--color-primary, #1a73e8)',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500
                        }}
                    >
                        Sign in
                    </button>
                )}
            </div>
        </header>
    );
};
