
import { formatRecipient, formatDateTime } from '../../utils/formatter';

interface EmailItemProps {
    email: any;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const EmailItem = ({ email, onClick, onDelete }: EmailItemProps) => {
    const isOpened = email.openCount > 0;

    return (
        <div
            onClick={onClick}
            style={{
                padding: '12px',
                backgroundColor: 'var(--color-bg-card)',
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                position: 'relative'
            }}
            className="email-item-hover"
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                if (btn) btn.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-card)';
                const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                if (btn) btn.style.opacity = '0';
            }}
        >
            <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--color-text-main)',
                    marginBottom: '2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {formatRecipient(email.recipient)}
                </div>
                <div style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {email.subject || '(No Subject)'}
                </div>
                {/* Body Snippet Preview */}
                {email.body && (
                    <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {email.body}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: isOpened ? 'var(--color-success-bg)' : 'var(--color-neutral-bg)',
                    color: isOpened ? 'var(--color-success-text)' : 'var(--color-neutral-text)',
                    marginBottom: '4px'
                }}>
                    {isOpened ? 'Opened' : 'Sent'}
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {formatDateTime(email.createdAt)}
                </span>
            </div>

            <button
                className="delete-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(e);
                }}
                title="Delete from history"
                style={{
                    position: 'absolute',
                    right: '8px',
                    top: '8px',
                    background: '#fee2e2',
                    border: 'none',
                    borderRadius: '4px',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    color: '#dc2626'
                }}
            >
                ×
            </button>
        </div>
    );
};
