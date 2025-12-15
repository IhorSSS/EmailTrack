
// React import removed

interface HeaderProps {
    onRefresh: () => void;
    loading: boolean;
}

export const Header = ({ onRefresh, loading }: HeaderProps) => {
    return (
        <header style={{
            height: '50px',
            padding: '0 var(--spacing-md)',
            background: 'var(--color-bg-card)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '24px' }}>📨</div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    EmailTrack
                </h1>
            </div>

            <button
                onClick={onRefresh}
                disabled={loading}
                style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px',
                    cursor: loading ? 'wait' : 'pointer',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-text-secondary)',
                    opacity: loading ? 0.5 : 1
                }}
                title="Refresh"
            >
                <svg
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.5s', transform: loading ? 'rotate(180deg)' : 'none' }}
                >
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        </header>
    );
};
