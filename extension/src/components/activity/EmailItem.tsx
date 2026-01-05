import { Badge } from '../common/Badge';
import { formatRecipient, formatDateTime } from '../../utils/formatter';
import styles from './EmailItem.module.css';

interface EmailItemProps {
    email: any;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const EmailItem = ({ email, onClick, onDelete }: EmailItemProps) => {
    const isOpened = email.openCount > 0;

    // Calculate last opened time
    const lastOpened = email.opens && email.opens.length > 0
        ? email.opens.reduce((latest: any, current: any) => {
            const latestTime = new Date(latest.openedAt || latest.timestamp || 0).getTime();
            const currentTime = new Date(current.openedAt || current.timestamp || 0).getTime();
            return currentTime > latestTime ? current : latest;
        })
        : null;

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
                        title="Delete from history"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className={styles.subject}>
                    {email.subject || '(No Subject)'}
                </div>
                {email.body && (
                    <div className={styles.body}>{email.body}</div>
                )}
            </div>

            <div className={styles.meta}>
                <div className={styles.metaRow}>
                    <Badge variant={isOpened ? 'success' : 'neutral'}>
                        {isOpened ? (email.openCount > 1 ? `Opened (${email.openCount})` : 'Opened') : 'Sent'}
                    </Badge>
                    {lastOpened && (
                        <span className={styles.timestamp}>
                            Last Opened: {formatDateTime(lastOpened.openedAt || lastOpened.timestamp)}
                        </span>
                    )}
                </div>

                <div className={styles.metaRow}>
                    <span className={styles.timestamp}>
                        Sent: {formatDateTime(email.createdAt)}
                    </span>
                </div>
            </div>
        </div>
    );
};
