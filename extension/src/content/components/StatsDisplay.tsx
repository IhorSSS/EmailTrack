import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Monitor, Smartphone, Clock, ShieldCheck } from 'lucide-react';
import './StatsDisplay.css';

import { format } from 'date-fns';

interface StatsDisplayProps {
    trackId: string;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ trackId }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const badgeRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        try {
            chrome.runtime.sendMessage({
                type: 'GET_STATS',
                trackId
            }, (response) => {
                if (chrome.runtime.lastError) return setLoading(false);
                if (response && !response.error) setStats(response);
                setLoading(false);
            });
        } catch (e) {
            setLoading(false);
        }
    }, [trackId]);

    const toggleDetails = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (openCount > 0) {
            if (!showDetails && badgeRef.current) {
                const rect = badgeRef.current.getBoundingClientRect();
                const POPUP_WIDTH = 320;
                const POPUP_HEIGHT = 300; // Approx max height

                let top = rect.bottom + window.scrollY + 8;
                let left = rect.left + window.scrollX;

                // Vertical collision
                if (rect.bottom + POPUP_HEIGHT > window.innerHeight) {
                    top = rect.top + window.scrollY - POPUP_HEIGHT - 8; // Flip up
                }

                // Horizontal collision
                if (rect.left + POPUP_WIDTH > window.innerWidth) {
                    left = window.innerWidth - POPUP_WIDTH - 20; // Shift left
                }

                setPopupStyle({ top, left });
            }
            setShowDetails(!showDetails);
        }
    };

    const closeDetails = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDetails(false);
    }

    if (loading) return <span className="email-track-badge loading">...</span>;
    if (!stats) return <span className="email-track-badge error">Error</span>;

    if (loading) return <span className="email-track-badge loading">...</span>;
    if (!stats) return <span className="email-track-badge error">Error</span>;

    // Filter Stats for Badge
    const realOpens = Array.isArray(stats.opens)
        ? stats.opens.filter((o: any) => {
            let data: any = {};
            try { data = o.device?.startsWith('{') ? JSON.parse(o.device) : { device: o.device }; } catch { data = { device: o.device }; }
            const isBot = data.isBot || data.device?.includes('Proxy') || data.browser?.includes('Proxy');
            return !isBot;
        })
        : [];

    const openCount = realOpens.length;
    const openText = openCount > 0 ? `${openCount} Open${openCount === 1 ? '' : 's'}` : 'Unopened';
    const statusClass = openCount > 0 ? 'opened' : 'sent';

    const getDeviceIcon = (deviceStr: string) => {
        const lower = (deviceStr || '').toLowerCase();
        if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) return <Smartphone className="et-icon" />;
        return <Monitor className="et-icon" />;
    };



    const formatLocation = (loc: string) => {
        if (!loc) return 'Unknown Location';
        // Remove leading comma if city is missing (e.g. ", US")
        if (loc.startsWith(', ')) return loc.substring(2);
        return loc;
    };

    return (
        <>
            <div className="email-track-stats-container">
                <span
                    ref={badgeRef}
                    className={`email-track-badge ${statusClass}`}
                    onClick={toggleDetails}
                    title="Click for history"
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {openCount > 0 && <span className="dot"></span>}
                    {openText}
                </span>
            </div>

            {showDetails && openCount > 0 && createPortal(
                <div className="email-track-portal-overlay" onClick={closeDetails}>
                    <div
                        className="email-track-details-popup"
                        style={popupStyle}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="et-popup-header">
                            <h4>Read History</h4>
                            <ShieldCheck size={16} color="#34a853" />
                        </div>
                        <ul className="opens-list">
                            {(() => {
                                // 1. Process and Group Events
                                const processedEvents = stats.opens.map((open: any) => {
                                    let deviceData: any = {};
                                    try {
                                        if (open.device && open.device.startsWith('{')) {
                                            deviceData = JSON.parse(open.device);
                                        } else {
                                            deviceData = { device: open.device };
                                        }
                                    } catch {
                                        deviceData = { device: open.device };
                                    }

                                    // Determine Label
                                    let deviceStr = '';
                                    const isBot = deviceData.isBot || deviceData.device?.includes('Proxy') || deviceData.browser?.includes('Proxy');

                                    if (isBot) {
                                        // Specific handling for standard Google Proxy signature to look cleaner
                                        if (deviceData.os === 'Windows XP' && deviceData.browser?.includes('Firefox 11')) {
                                            deviceStr = 'Gmail (via Google Proxy)';
                                        } else {
                                            deviceStr = 'Gmail Proxy';
                                        }
                                    } else if (deviceData.browser || deviceData.os) {
                                        deviceStr = `${deviceData.browser || ''} on ${deviceData.os || ''}`;
                                    } else {
                                        deviceStr = deviceData.device || 'Unknown Device';
                                    }

                                    return {
                                        ...open,
                                        deviceStr,
                                        isBot,
                                        location: formatLocation(open.location),
                                        timestamp: new Date(open.openedAt).getTime()
                                    };
                                });

                                // 2. Filter out Bots from Display (User Requirement)
                                const realEvents = processedEvents.filter((e: any) => !e.isBot);

                                // 3. Group Consecutive Similar Events
                                const groupedEvents: any[] = [];
                                realEvents.forEach((current: any) => {
                                    const last = groupedEvents[groupedEvents.length - 1];
                                    // Check if same device & location (ignore time for now, or use loose window)
                                    // Using a 10-minute window for grouping "spammy" reloads
                                    const isSame = last &&
                                        last.deviceStr === current.deviceStr &&
                                        last.location === current.location &&
                                        (last.timestamp - current.timestamp < 10 * 60 * 1000); // Descending order usually

                                    if (isSame) {
                                        last.count = (last.count || 1) + 1;
                                    } else {
                                        groupedEvents.push({ ...current, count: 1 });
                                    }
                                });

                                if (groupedEvents.length === 0) {
                                    return <li className="et-timeline-item" style={{ justifyContent: 'center', color: '#888' }}>No real opens yet</li>;
                                }

                                return groupedEvents.map((open: any, index: number) => {
                                    return (
                                        <li key={index} className="et-timeline-item">
                                            <div className="et-row">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                                    <Clock className="et-icon" size={14} style={{ color: '#1a73e8' }} />
                                                    <span className="et-time">
                                                        {format(new Date(open.openedAt), 'MMM d, HH:mm')}
                                                    </span>
                                                </div>
                                                {open.count > 1 && (
                                                    <span style={{
                                                        background: '#e8f0fe',
                                                        color: '#1a73e8',
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        borderRadius: '10px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        x{open.count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="et-row">
                                                <MapPin className="et-icon" />
                                                <span className="et-location">
                                                    {open.location}
                                                </span>
                                            </div>
                                            <div className="et-row">
                                                {getDeviceIcon(open.deviceStr)}
                                                <span className="et-device">
                                                    {open.deviceStr}
                                                </span>
                                            </div>
                                        </li>
                                    );
                                });
                            })()}
                        </ul>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default StatsDisplay;
