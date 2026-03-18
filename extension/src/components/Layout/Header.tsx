import type { UserProfile } from '../../services/AuthService';
import { Button } from '../common/Button';
import { RefreshButton } from '../common/RefreshButton';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './Header.module.css';

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
        <header className={`glass ${styles.header}`}>
            <div className={styles.leftSection}>
                <div className={styles.logoContainer}>
                    <img src="/icon.png" alt={t('app_name')} className={styles.logoImage} />
                </div>
                <h1 className={styles.title}>
                    {t('app_name')}
                </h1>
            </div>

            <div className={styles.rightSection}>
                <RefreshButton
                    onClick={onRefresh}
                    loading={loading}
                />

                <div className={styles.divider}></div>

                {userProfile ? (
                    <div className={styles.profileSection}>
                        <img
                            src={userProfile.picture}
                            alt={userProfile.name}
                            title={t('header_signed_in_as', { email: userProfile.email })}
                            className={styles.profileImage}
                        />
                        <button
                            onClick={onLogout}
                            className={styles.logoutButton}
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

