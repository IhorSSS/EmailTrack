
import { formatRecipient, formatDateTime } from '../../utils/formatter';
import styles from './EmailItem.module.css';

interface EmailItemProps {
    email: any;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const EmailItem = ({ email, onClick, onDelete }: EmailItemProps) => {
    const isOpened = email.openCount > 0;

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
                <span className={`${styles.badge} ${isOpened ? styles.badgeOpened : styles.badgeSent}`}>
                    {isOpened ? 'Opened' : 'Sent'}
                </span>
                <span className={styles.timestamp}>
                    {formatDateTime(email.createdAt)}
                </span>
            </div>

            <button
                className={styles.deleteBtn}
                onClick={onDelete}
                title="Delete from history"
            >
                ×
            </button>
        </div>
    );
};
