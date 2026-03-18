import React from 'react';
import { Clock, MapPin, ChevronDown } from 'lucide-react';
import { CONSTANTS } from '../../../config/constants';
import type { ProcessedEvent } from '../../../utils/statsProcessor';

interface StatsHistoryItemProps {
    event: ProcessedEvent;
    index: number;
    isExpanded: boolean;
    toggleGroup: (index: number) => void;
    formatDate: (dateStr: string) => string;
    getDeviceIcon: (deviceStr: string) => React.ReactNode;
    t_grouped_opens: string;
}

export const StatsHistoryItem: React.FC<StatsHistoryItemProps> = ({
    event,
    index,
    isExpanded,
    toggleGroup,
    formatDate,
    getDeviceIcon,
    t_grouped_opens
}) => {
    const isGrouped = (event.count || 0) > 1;

    if (!isGrouped) {
        return (
            <li className="et-timeline-item">
                <div className="et-row">
                    <div className="et-row-flex-1">
                        <Clock className="et-icon et-icon-info" size={CONSTANTS.LAYOUT.ICON_SIZE_SMALL} />
                        <span className="et-time">{formatDate(event.openedAt || '')}</span>
                    </div>
                </div>
                <div className="et-row">
                    <MapPin className="et-icon" />
                    <span className="et-location">{event.location}</span>
                </div>
                <div className="et-row">
                    {getDeviceIcon(event.deviceStr || '')}
                    <span className="et-device">{event.deviceStr}</span>
                </div>
            </li>
        );
    }

    if (!isExpanded) {
        return (
            <li
                className="et-timeline-item et-grouped"
                onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(index);
                }}
            >
                <div className="et-row">
                    <div className="et-row-flex-1">
                        <Clock className="et-icon et-icon-info" size={CONSTANTS.LAYOUT.ICON_SIZE_SMALL} />
                        <span className="et-time">{formatDate(event.openedAt || '')}</span>
                    </div>
                    <span className="et-count-badge">x{event.count}</span>
                    <span className="et-chevron">
                        <ChevronDown size={CONSTANTS.LAYOUT.ICON_SIZE_SMALL} />
                    </span>
                </div>
                <div className="et-row">
                    <MapPin className="et-icon" />
                    <span className="et-location">{event.location}</span>
                </div>
                <div className="et-row">
                    {getDeviceIcon(event.deviceStr || '')}
                    <span className="et-device">{event.deviceStr}</span>
                </div>
            </li>
        );
    }

    return (
        <li className="et-timeline-group-expanded">
            <div
                className="et-group-header"
                onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(index);
                }}
            >
                <span>{t_grouped_opens}</span>
                <span className="et-chevron expanded">
                    <ChevronDown size={CONSTANTS.LAYOUT.ICON_SIZE_SMALL} />
                </span>
            </div>
            {(event.items || []).map((item, itemIdx) => (
                <div key={itemIdx} className="et-group-item">
                    <div className="et-row">
                        <div className="et-row-flex-1">
                            <Clock className="et-icon et-icon-info" size={CONSTANTS.LAYOUT.ICON_SIZE_SMALL} />
                            <span className="et-time">{formatDate(item.openedAt || '')}</span>
                        </div>
                    </div>
                    <div className="et-row">
                        <MapPin className="et-icon" />
                        <span className="et-location">{item.location}</span>
                    </div>
                    <div className="et-row">
                        {getDeviceIcon(item.deviceStr || '')}
                        <span className="et-device">{item.deviceStr}</span>
                    </div>
                </div>
            ))}
        </li>
    );
};
