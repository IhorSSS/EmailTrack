import { Badge } from '../common/Badge';
import { formatRecipient, formatDateTime } from '../../utils/formatter';
import styles from './EmailItem.module.css';
import { useTranslation } from '../../hooks/useTranslation';

interface EmailItemProps {
    email: any;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const EmailItem = ({ email, onClick, onDelete }: EmailItemProps) => {
    const { t, language } = useTranslation();
    const isOpened = email.openCount > 0;

    // Calculate last opened time
    const lastOpened = email.opens && email.opens.length > 0
        ? email.opens.reduce((latest: any, current: any) => {
            const latestTime = new Date(latest.openedAt || latest.timestamp || 0).getTime();
            const currentTime = new Date(current.openedAt || current.timestamp || 0).getTime();
            return currentTime > latestTime ? current : latest;
        })
        : null;

    // Determine locale for formatting (e.g., 'uk-UA' or 'en-US')
    // Since our language state is 'en' or 'uk' or 'system', we map it.
    const localeMap: Record<string, string> = {
        'en': 'en-US',
        'uk': 'uk-UA'
    };
    const currentLocale = language === 'system' ? navigator.language : (localeMap[language] || 'en-US');

    return (
        <div className={styles.container} onClick={onClick}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <div className={styles.recipient}>
                        {formatRecipient(email.recipient, t as any)}
                    </div>
                    <button
                        className={styles.deleteButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(e);
                        }}
                        title={t('activity_delete_tooltip')}
                        aria-label={t('activity_delete_tooltip')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className={styles.subject}>
                    {email.subject || t('detail_no_subject')}
                </div>
                {email.body && (
                    <div className={styles.body}>{email.body}</div>
                )}
            </div>

            <div className={styles.meta}>
                <div className={styles.metaRow}>
                    <Badge variant={isOpened ? 'success' : 'neutral'}>
                        {isOpened ? `${t('detail_len_opens', { count: email.openCount })}` : t('email_sent')}
                    </Badge>
                    {lastOpened && (
                        <span className={styles.timestamp}>
                            {t('email_last_opened', { date: formatDateTime(lastOpened.openedAt || lastOpened.timestamp, currentLocale) })}
                        </span>
                    )}
                </div>

                <div className={styles.metaRow}>
                    <span className={styles.timestamp}>
                        {formatDateTime(email.createdAt, currentLocale)}
                    </span>
                </div>
            </div>
        </div>
    );
};
