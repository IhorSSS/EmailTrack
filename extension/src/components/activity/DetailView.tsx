import { Badge } from '../common/Badge';
import { formatRecipient, formatFullDate } from '../../utils/formatter';
import { RefreshButton } from '../common/RefreshButton';
import { logger } from '../../utils/logger';
import type { TrackedEmail, OpenEvent } from '../../types';
import styles from './DetailView.module.css';

interface DetailViewProps {
    email: TrackedEmail;
    onBack: () => void;
    onRefresh: () => void;
    loading: boolean;
}

export const DetailView = ({ email, onBack, onRefresh, loading }: DetailViewProps) => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button onClick={onBack} className={styles.backBtn}>
                    ← Back
                </button>
                <h3 className={styles.title}>Message Details</h3>
                <RefreshButton
                    onClick={onRefresh}
                    loading={loading}
                    title="Refresh status"
                />
            </div>

            <div className={styles.content}>
                <div className={styles.section}>
                    <label className={styles.label}>Recipient</label>
                    <div className={styles.value}>
                        {formatRecipient(email.recipient)}
                    </div>
                </div>

                {email.cc && (
                    <div className={styles.section}>
                        <label className={styles.label}>CC</label>
                        <div className={styles.value}>
                            {formatRecipient(email.cc)}
                        </div>
                    </div>
                )}

                {email.bcc && (
                    <div className={styles.section}>
                        <label className={styles.label}>BCC</label>
                        <div className={styles.value}>
                            {formatRecipient(email.bcc)}
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <label className={styles.label}>Subject</label>
                    <div className={styles.value}>
                        {email.subject || '(No Subject)'}
                    </div>
                </div>

                {email.body && (
                    <div className={styles.section}>
                        <label className={styles.label}>Body Preview</label>
                        <div className={styles.value} style={{ fontSize: '13px', lineHeight: '1.4', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                            {email.body}
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <label className={styles.label}>Sent At</label>
                    <div className={styles.valueSmall}>
                        {formatFullDate(email.createdAt)}
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <label className={styles.label} style={{ margin: 0 }}>Open History</label>
                        {email.openCount > 0 && (
                            <Badge variant="success" shape="pill">{email.openCount}</Badge>
                        )}
                    </div>
                    {(!email.opens || email.opens.length === 0) ? (
                        <div className={styles.emptyState}>
                            No opens recorded yet.
                        </div>
                    ) : (
                        <div className={styles.opensList}>
                            {email.opens.map((open: OpenEvent, idx: number) => {
                                // Parse device JSON
                                let deviceInfo = { device: 'Unknown', os: 'Unknown', browser: 'Unknown', isBot: false };
                                try {
                                    if (open.device) {
                                        deviceInfo = JSON.parse(open.device);
                                    }
                                } catch (e) {
                                    logger.warn('Failed to parse device:', e);
                                }

                                return (
                                    <div
                                        key={idx}
                                        className={styles.openItem}
                                    >
                                        <div className={styles.openRow}>
                                            <Badge variant="success">Opened</Badge>
                                            <span className={styles.openTimestamp}>
                                                {formatFullDate(open.openedAt || open.timestamp || new Date().toISOString())}
                                            </span>
                                        </div>

                                        {/* Device Details */}
                                        <div className={styles.openDetails}>
                                            <div className={styles.detailRow}>
                                                <span className={styles.detailIcon}>📱</span>
                                                <span className={styles.detailText}>
                                                    {deviceInfo.device || 'Unknown Device'}
                                                    {deviceInfo.isBot && (
                                                        <Badge variant="warning" shape="square" style={{ marginLeft: '8px', fontSize: '9px', padding: '1px 4px' }}>
                                                            BOT
                                                        </Badge>
                                                    )}
                                                </span>
                                            </div>
                                            <div className={styles.detailRow}>
                                                <span className={styles.detailIcon}>💻</span>
                                                <span className={styles.detailText}>
                                                    {deviceInfo.os || 'Unknown OS'} • {deviceInfo.browser || 'Unknown Browser'}
                                                </span>
                                            </div>
                                            <div className={styles.detailRow}>
                                                <span className={styles.detailIcon}>🌍</span>
                                                <span className={styles.detailText}>
                                                    {open.location || 'Unknown'} • {open.ip || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
