import { Badge } from '../common/Badge';
import { formatRecipient, formatDateTime } from '../../utils/formatter';
import styles from './EmailItem.module.css';

interface EmailItemProps {
    email: any;
    onClick: () => void;
}

export const EmailItem = ({ email, onClick }: EmailItemProps) => {
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
                <div className={styles.recipient}>
                    {formatRecipient(email.recipient)}
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
