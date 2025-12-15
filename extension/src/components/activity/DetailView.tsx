
import { formatRecipient, formatFullDate } from '../../utils/formatter';
import styles from './DetailView.module.css';

interface DetailViewProps {
    email: any;
    onBack: () => void;
}

export const DetailView = ({ email, onBack }: DetailViewProps) => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button onClick={onBack} className={styles.backBtn}>
                    ← Back
                </button>
                <h3 className={styles.title}>Message Details</h3>
            </div>

            <div className={styles.content}>
                <div className={styles.section}>
                    <label className={styles.label}>Recipient</label>
                    <div className={styles.value}>
                        {formatRecipient(email.recipient)}
                    </div>
                </div>

                <div className={styles.section}>
                    <label className={styles.label}>Subject</label>
                    <div className={styles.value}>
                        {email.subject || '(No Subject)'}
                    </div>
                </div>

                <div className={styles.section}>
                    <label className={styles.label}>Sent At</label>
                    <div className={styles.valueSmall}>
                        {formatFullDate(email.createdAt)}
                    </div>
                </div>

                <div>
                    <label className={styles.label} style={{ display: 'block', marginBottom: '8px' }}>Open History</label>
                    {(!email.opens || email.opens.length === 0) ? (
                        <div className={styles.emptyState}>
                            No opens recorded yet.
                        </div>
                    ) : (
                        <div className={styles.opensList}>
                            {email.opens.map((open: any, idx: number) => (
                                <div
                                    key={idx}
                                    className={`${styles.openItem} ${idx < email.opens.length - 1 ? styles.openItemDivider : ''}`}
                                >
                                    <div className={styles.openRow}>
                                        <span className={styles.openLabel}>Opened</span>
                                        <span className={styles.openTimestamp}>
                                            {formatFullDate(open.timestamp || open.createdAt || new Date())}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
