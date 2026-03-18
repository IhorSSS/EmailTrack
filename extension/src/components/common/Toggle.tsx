import React from 'react';
import styles from './Toggle.module.css';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled = false, size = 'md' }) => {
    return (
        <label className={`${styles.toggle} ${styles[size]} ${disabled ? styles.disabled : ''}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => !disabled && onChange(e.target.checked)}
                disabled={disabled}
                className={styles.input}
            />
            <span className={`${styles.slider} ${checked ? styles.checked : ''}`}>
                <span className={`${styles.knob} ${checked ? styles.knobChecked : ''}`} />
            </span>
        </label>
    );
};
