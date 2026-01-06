import React from 'react';
import { Header } from './Header';
import { TabButton } from '../common/TabButton';
import type { UserProfile } from '../../services/AuthService';
import { useTranslation } from '../../hooks/useTranslation';

interface MainLayoutProps {
    children: React.ReactNode;
    userProfile: UserProfile | null;
    loading: boolean;
    onLogin: () => void;
    onLogout: () => void;
    onRefresh: () => void;
    currentView: 'dashboard' | 'activity' | 'settings';
    onViewChange: (view: 'dashboard' | 'activity' | 'settings') => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    userProfile,
    loading,
    onLogin,
    onLogout,
    onRefresh,
    currentView,
    onViewChange
}) => {
    const { t } = useTranslation();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)' }}>
            <Header
                onRefresh={onRefresh}
                loading={loading}
                userProfile={userProfile}
                onLogin={onLogin}
                onLogout={onLogout}
            />

            {/* Content Area */}
            <main style={{
                flex: 1,
                overflowY: 'auto',
                background: 'var(--bg-app)',
                position: 'relative',
                paddingBottom: '20px' // Space before nav
            }}>
                <div className="animate-fade-in">
                    {children}
                </div>
            </main>

            {/* Bottom Tabs */}
            <nav className="glass" style={{
                height: 'var(--nav-height)',
                background: 'var(--bg-header)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                flexShrink: 0,
                zIndex: 50,
                paddingBottom: 'env(safe-area-inset-bottom)',
                minHeight: '64px'
            }}>
                <TabButton label={t('nav_overview')} icon="dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} />
                <TabButton label={t('nav_activity')} icon="activity" active={currentView === 'activity'} onClick={() => onViewChange('activity')} />
                <TabButton label={t('nav_settings')} icon="settings" active={currentView === 'settings'} onClick={() => onViewChange('settings')} />
            </nav>
        </div>
    );
};

