import React from 'react';
import { Header } from './Header';
import { TabButton } from '../common/TabButton';
import type { UserProfile } from '../../services/AuthService';

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
    return (
        <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Header
                onRefresh={onRefresh}
                loading={loading}
                userProfile={userProfile}
                onLogin={onLogin}
                onLogout={onLogout}
            />

            {/* Content Area */}
            <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>
                {children}
            </main>

            {/* Bottom Tabs */}
            <nav style={{
                height: '60px', background: 'var(--color-bg-card)',
                display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexShrink: 0
            }}>
                <TabButton label="Dashboard" icon="📊" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} />
                <TabButton label="Activity" icon="list" active={currentView === 'activity'} onClick={() => onViewChange('activity')} />
                <TabButton label="Settings" icon="⚙️" active={currentView === 'settings'} onClick={() => onViewChange('settings')} />
            </nav>
        </div>
    );
};
