import React from 'react';
import { RefreshCw } from 'lucide-react';
import { CONSTANTS } from '../../../config/constants';

interface StatsBadgeProps {
    statusClass: string;
    toggleDetails: (e: React.MouseEvent) => void;
    openCount: number;
    displayOpenText: string;
    refreshing: boolean;
    handleRefresh: (e: React.MouseEvent) => void;
    title: string;
    refreshTitle: string;
    badgeRef: React.RefObject<HTMLSpanElement | null>;
}

export const StatsBadge: React.FC<StatsBadgeProps> = ({
    statusClass,
    toggleDetails,
    openCount,
    displayOpenText,
    refreshing,
    handleRefresh,
    title,
    refreshTitle,
    badgeRef
}) => {
    return (
        <span
            ref={badgeRef}
            className={`email-track-badge ${statusClass} et-no-wrap`}
            onClick={toggleDetails}
            title={title}
        >
            {openCount > 0 && <span className="dot"></span>}
            {displayOpenText}

            <button
                className={`et-refresh-btn ${refreshing ? 'rotating' : ''}`}
                onClick={handleRefresh}
                title={refreshTitle}
            >
                <RefreshCw size={CONSTANTS.LAYOUT.ICON_SIZE_TINY} />
            </button>
        </span>
    );
};
