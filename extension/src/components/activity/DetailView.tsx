
// React import removed
import { formatRecipient, formatFullDate } from '../../utils/formatter';

interface DetailViewProps {
    email: any;
    onBack: () => void;
}

export const DetailView = ({ email, onBack }: DetailViewProps) => {
    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
            {/* Detail Header */}
            <div style={{
                padding: '16px',
                background: 'var(--color-bg-card)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
            }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                        color: 'var(--color-text-secondary)'
                    }}
                >
                    ← Back
                </button>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Message Details</h3>
            </div>

            <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Recipient</label>
                    <div style={{ fontSize: '15px', color: 'var(--color-text-main)', marginTop: '4px' }}>
                        {formatRecipient(email.recipient)}
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Subject</label>
                    <div style={{ fontSize: '15px', color: 'var(--color-text-main)', marginTop: '4px' }}>
                        {email.subject || '(No Subject)'}
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Sent At</label>
                    <div style={{ fontSize: '14px', color: 'var(--color-text-main)', marginTop: '4px' }}>
                        {formatFullDate(email.createdAt)}
                    </div>
                </div>

                <div>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Open History</label>
                    {(!email.opens || email.opens.length === 0) ? (
                        <div style={{ padding: '12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px', color: '#64748b' }}>
                            No opens recorded yet.
                        </div>
                    ) : (
                        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                            {email.opens.map((open: any, idx: number) => (
                                <div key={idx} style={{
                                    padding: '12px',
                                    borderBottom: idx < email.opens.length - 1 ? '1px solid var(--color-border)' : 'none',
                                    fontSize: '13px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 500, color: '#166534' }}>Opened</span>
                                        <span style={{ color: 'var(--color-text-secondary)' }}>{formatFullDate(open.timestamp || open.createdAt || new Date())}</span>
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
