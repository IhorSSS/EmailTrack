import { Badge } from '../common/Badge';
import styles from './EmailItem.module.css';
import { useTranslation } from '../../hooks/useTranslation';
import { useEmailFormatting } from '../../hooks/useEmailFormatting';

import type { TrackedEmail } from '../../types';

interface EmailItemProps {
    email: TrackedEmail;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const EmailItem = ({ email, onClick, onDelete }: EmailItemProps) => {
    const { t } = useTranslation();
    const { formatRecipient, formatDateTime } = useEmailFormatting();
    const isOpened = email.openCount > 0;

    return (
        <div className={styles.container} onClick={onClick}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <div className={styles.recipient}>
                        {formatRecipient(email.recipient)}
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
                        {isOpened ? (
                            <Badge variant="success">
                                {t('detail_len_opens', { count: String(email.openCount) })}
                            </Badge>
                        ) : (
                            <Badge variant="neutral">{t('email_sent')}</Badge>
                        )}
                    {email.opens && email.opens.length > 0 && (
                        <span className={styles.timestamp}>
                            {t('email_last_opened', { date: formatDateTime(email.opens[email.opens.length - 1].openedAt || email.opens[email.opens.length - 1].timestamp || '') })}
                        </span>
                    )}
                </div>

                <div className={styles.metaRow}>
                    <span className={styles.timestamp}>
                        {formatDateTime(email.createdAt)}
                    </span>
                </div>
            </div>
        </div>
    );
};
