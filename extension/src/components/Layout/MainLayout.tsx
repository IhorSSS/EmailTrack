import React from 'react';
import { Header } from './Header';
import { TabButton } from '../common/TabButton';
import type { UserProfile } from '../../services/AuthService';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './MainLayout.module.css';

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
        <div className={styles.layout}>
            <Header
                onRefresh={onRefresh}
                loading={loading}
                userProfile={userProfile}
                onLogin={onLogin}
                onLogout={onLogout}
            />

            {/* Content Area */}
            <main className={styles.mainContent}>
                <div className={`animate-fade-in ${styles.contentWrapper}`}>
                    {children}
                </div>
            </main>

            {/* Bottom Tabs */}
            <nav className={`glass ${styles.bottomNav}`}>
                <TabButton label={t('nav_overview')} icon="dashboard" active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} />
                <TabButton label={t('nav_activity')} icon="activity" active={currentView === 'activity'} onClick={() => onViewChange('activity')} />
                <TabButton label={t('nav_settings')} icon="settings" active={currentView === 'settings'} onClick={() => onViewChange('settings')} />
            </nav>
        </div>
    );
};

