import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, style, ...props }) => {
    return (
        <div style={{ width: '100%' }}>
            {label && (
                <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                }}>
                    {label}
                </label>
            )}
            <div style={{ position: 'relative' }}>
                <select
                    style={{
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        appearance: 'none',
                        cursor: 'pointer',
                        transition: 'var(--transition-base)',
                        outline: 'none',
                        ...style as any,
                    }}
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div style={{
                    position: 'absolute',
                    right: 'var(--spacing-md)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--text-muted)'
                }}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M1 1L5 5L9 1" />
                    </svg>
                </div>
            </div>
        </div>
    );
};
