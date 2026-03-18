import React from 'react';
import { createPortal } from 'react-dom';
import { StatsHistoryItem } from './StatsHistoryItem';
import type { ProcessedEvent } from '../../../utils/statsProcessor';

interface StatsPortalProps {
    showDetails: boolean;
    currentTheme: string;
    closeDetails: (e: React.MouseEvent) => void;
    popupStyle: React.CSSProperties;
    title: string;
    groupedEvents: ProcessedEvent[];
    expandedGroups: Set<number>;
    toggleGroup: (index: number) => void;
    formatDate: (dateStr: string) => string;
    getDeviceIcon: (deviceStr: string) => React.ReactNode;
    t_no_opens: string;
    t_grouped_opens_fn: (count: number) => string;
}

export const StatsPortal: React.FC<StatsPortalProps> = ({
    showDetails,
    currentTheme,
    closeDetails,
    popupStyle,
    title,
    groupedEvents,
    expandedGroups,
    toggleGroup,
    formatDate,
    getDeviceIcon,
    t_no_opens,
    t_grouped_opens_fn
}) => {
    if (!showDetails) return null;

    return createPortal(
        <div className="email-track-portal-overlay" data-theme={currentTheme} onClick={closeDetails}>
            <div
                className="email-track-details-popup"
                style={popupStyle}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="et-popup-header">
                    <h4>{title}</h4>
                </div>
                <ul className="opens-list">
                    {groupedEvents.length === 0 ? (
                        <li className="et-timeline-item et-center-muted">{t_no_opens}</li>
                    ) : (
                        groupedEvents.map((event, index) => (
                            <StatsHistoryItem
                                key={index}
                                event={event}
                                index={index}
                                isExpanded={expandedGroups.has(index)}
                                toggleGroup={toggleGroup}
                                formatDate={formatDate}
                                getDeviceIcon={getDeviceIcon}
                                t_grouped_opens={t_grouped_opens_fn(event.count || 0)}
                            />
                        ))
                    )}
                </ul>
            </div>
        </div>,
        document.body
    );
};
