import React from 'react';
import { CONSTANTS } from '../../config/constants';
import { useTranslation } from '../../hooks/useTranslation';
import { formatTime } from '../../utils/formatter';

interface StatusCheckmarkProps {
    status: 'sent' | 'opened';
    lastOpenedAt?: string | Date;
    compact?: boolean;
}

/**
 * StatusCheckmark - Atomic component for showing email status ticks.
 * Follows the 'Situational Awareness' design principle.
 */
const StatusCheckmark: React.FC<StatusCheckmarkProps> = ({ status, lastOpenedAt, compact = false }) => {
    const { t } = useTranslation();
    const isOpened = status === 'opened';
    
    const tooltipText = isOpened 
        ? `${t('status_last_opened')}: ${lastOpenedAt ? formatTime(lastOpenedAt) : '...'}`
        : t('email_sent');

    const size = compact ? CONSTANTS.LAYOUT.ICON_SIZE_TINY : CONSTANTS.LAYOUT.ICON_SIZE_SMALL;

    return (
        <span 
            className="et-checkmark-root" 
            title={tooltipText}
        >
            <svg 
                className="et-checkmark-svg"
                width={size * 1.5} 
                height={size} 
                viewBox="0 0 24 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* First Tick */}
                <path 
                    d="M1 9L5 13L13 5" 
                    stroke="var(--et-color-tick-single)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />
                {/* Second Tick (Offset) */}
                {isOpened && (
                    <path 
                        className="et-checkmark-tick-second"
                        d="M7 9L11 13L19 5" 
                        stroke="var(--et-color-tick-double)" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                    />
                )}
            </svg>
        </span>
    );
};

export default StatusCheckmark;
