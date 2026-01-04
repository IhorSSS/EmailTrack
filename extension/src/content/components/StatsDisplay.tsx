import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Monitor, Smartphone, Clock, ShieldCheck, RefreshCw, ChevronDown } from 'lucide-react';
import './StatsDisplay.css';
import { format } from 'date-fns';
import { theme } from '../../config/theme';
import { CONSTANTS } from '../../config/constants';

interface StatsDisplayProps {
    trackId: string;
    senderHint?: string;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ trackId, senderHint }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // New state for manual refresh
    const [showDetails, setShowDetails] = useState(false);
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set()); // Track expanded groups
    const badgeRef = useRef<HTMLSpanElement>(null);

    const [contextInvalidated, setContextInvalidated] = useState(false);

    const fetchStats = (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            // Check if runtime exists (basic invalidation check)
            if (!chrome.runtime?.id) throw new Error("Extension context invalidated");

            chrome.runtime.sendMessage({
                type: 'GET_STATS',
                trackId,
                senderHint
            }, (response) => {
                const lastError = chrome.runtime?.lastError;
                if (lastError) {
                    const msg = lastError.message || '';
                    if (msg.includes('context invalidated')) {
                        setContextInvalidated(true);
                    }
                    setLoading(false);
                    setRefreshing(false);
                    return;
                }
                if (response) setStats(response);
                setLoading(false);
                setRefreshing(false);
            });
        } catch (e: any) {
            const msg = e?.message || '';
            if (msg.includes('context invalidated') || msg.includes('Extension context invalidated')) {
                setContextInvalidated(true);
            }
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [trackId]);

    const handleRefresh = (e: React.MouseEvent) => {
        e.stopPropagation(); // Don't toggle details
        fetchStats(true);
    };

    const toggleDetails = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (openCount > 0) {
            if (!showDetails && badgeRef.current) {
                const rect = badgeRef.current.getBoundingClientRect();
                const { POPUP } = CONSTANTS;

                // Calculate available space in viewport
                const spaceBelow = window.innerHeight - rect.bottom;

                let style: React.CSSProperties = { left: rect.left };

                // Simple positioning logic
                if (spaceBelow >= 200) {
                    // Enough space below - position below badge
                    style.top = rect.bottom + POPUP.OFFSET;
                } else {
                    // Not enough space below - position above badge using bottom
                    style.bottom = window.innerHeight - rect.top + POPUP.OFFSET;
                }

                // Horizontal collision
                if (rect.left + POPUP.WIDTH > window.innerWidth) {
                    style.left = window.innerWidth - POPUP.WIDTH - 20;
                }

                setPopupStyle(style);
            }
            setShowDetails(!showDetails);
        }
    };

    const closeDetails = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDetails(false);
    }

    const toggleGroup = (index: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    if (contextInvalidated) {
        return (
            <div className="email-track-stats-container">
                <span
                    className="email-track-badge error"
                    title="Extension updated. Please reload the page."
                    style={{ cursor: 'help', whiteSpace: 'nowrap' }}
                >
                    ⚠️ Reload
                </span>
            </div>
        );
    }

    if (loading) return <span className="email-track-badge loading">...</span>;

    // OWNERSHIP CHECK: If 404, email is deleted or not owned by current user -> hide badge
    if (stats && (stats as any).status === 404) {
        return null;
    }

    // OFFLINE FIX: If network error (not 404), show "Sent" as fallback
    const effectiveStats = (!stats || (stats as any).error) ? { opens: [] } : stats;

    const openCount = Array.isArray(effectiveStats.opens) ? effectiveStats.opens.length : (typeof effectiveStats.opens === 'number' ? effectiveStats.opens : 0);
    const openText = openCount > 0 ? `${openCount} Open${openCount === 1 ? '' : 's'}` : 'Unopened';
    const statusClass = openCount > 0 ? 'opened' : 'sent';

    const getDeviceIcon = (deviceStr: string) => {
        const lower = (deviceStr || '').toLowerCase();
        if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) return <Smartphone className="et-icon" />;
        return <Monitor className="et-icon" />;
    };

    const formatLocation = (loc: string) => {
        if (!loc) return 'Unknown Location';
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

                    <button
                        className={`et-refresh-btn ${refreshing ? 'rotating' : ''}`}
                        onClick={handleRefresh}
                        title="Refresh status"
                    >
                        <RefreshCw size={12} />
                    </button>
                </span>
            </div>

            {/* ... popup logic ... */}

            {showDetails && openCount > 0 && createPortal(
                <div className="email-track-portal-overlay" onClick={closeDetails}>
                    <div
                        className="email-track-details-popup"
                        style={popupStyle}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="et-popup-header">
                            <h4>Read History</h4>
                            <ShieldCheck size={16} color={theme.colors.success} />
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
                                        // Standardize Gmail Proxy label
                                        if (deviceData.os === 'Windows XP' && deviceData.browser?.includes('Firefox 11')) {
                                            deviceStr = 'Gmail'; // Simple, clean label
                                        } else if (deviceData.raw?.includes('GoogleImageProxy')) {
                                            deviceStr = 'Gmail';
                                        } else {
                                            deviceStr = 'Proxy/Server';
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

                                // 3. Group Consecutive Similar Events
                                const groupedEvents: any[] = [];
                                processedEvents.forEach((current: any) => {
                                    const last = groupedEvents[groupedEvents.length - 1];
                                    // Check if same device & location (ignore time for now, or use loose window)
                                    // Using a 10-minute window for grouping "spammy" reloads
                                    const isSame = last &&
                                        last.deviceStr === current.deviceStr &&
                                        last.location === current.location &&
                                        (last.timestamp - current.timestamp < CONSTANTS.GROUPING_WINDOW_MS); // Descending order usually

                                    if (isSame) {
                                        last.count = (last.count || 1) + 1;
                                        // Store items for expansion
                                        if (!last.items) {
                                            last.items = [{ ...last }]; // Store first item
                                        }
                                        last.items.push(current);
                                    } else {
                                        groupedEvents.push({ ...current, count: 1, items: [current] });
                                    }
                                });

                                if (groupedEvents.length === 0) {
                                    return <li className="et-timeline-item" style={{ justifyContent: 'center', color: theme.colors.text.muted }}>No opens recorded</li>;
                                }

                                return groupedEvents.map((open: any, index: number) => {
                                    const isExpanded = expandedGroups.has(index);
                                    const isGrouped = open.count > 1;

                                    // Single item (not grouped)
                                    if (!isGrouped) {
                                        return (
                                            <li key={index} className="et-timeline-item">
                                                <div className="et-row">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                                        <Clock className="et-icon" size={14} style={{ color: theme.colors.info }} />
                                                        <span className="et-time">
                                                            {format(new Date(open.openedAt), 'MMM d, HH:mm')}
                                                        </span>
                                                    </div>
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
                                    }

                                    // Grouped item - collapsed
                                    if (!isExpanded) {
                                        return (
                                            <li
                                                key={index}
                                                className="et-timeline-item et-grouped"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleGroup(index);
                                                }}
                                            >
                                                <div className="et-row">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                                        <Clock className="et-icon" size={14} style={{ color: theme.colors.info }} />
                                                        <span className="et-time">
                                                            {format(new Date(open.openedAt), 'MMM d, HH:mm')}
                                                        </span>
                                                    </div>
                                                    <span style={{
                                                        background: theme.colors.infoBg,
                                                        color: theme.colors.info,
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        borderRadius: '10px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        x{open.count}
                                                    </span>
                                                    <span className="et-chevron">
                                                        <ChevronDown size={14} />
                                                    </span>
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
                                    }

                                    // Grouped item - expanded
                                    return (
                                        <li key={index} className="et-timeline-group-expanded">
                                            <div
                                                className="et-group-header"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleGroup(index);
                                                }}
                                            >
                                                <span>Grouped Opens (x{open.count})</span>
                                                <span className="et-chevron expanded">
                                                    <ChevronDown size={14} />
                                                </span>
                                            </div>
                                            {open.items.map((item: any, itemIdx: number) => (
                                                <div key={itemIdx} className="et-group-item">
                                                    <div className="et-row">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                                            <Clock className="et-icon" size={14} style={{ color: theme.colors.info }} />
                                                            <span className="et-time">
                                                                {format(new Date(item.openedAt), 'MMM d, HH:mm')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="et-row">
                                                        <MapPin className="et-icon" />
                                                        <span className="et-location">
                                                            {item.location}
                                                        </span>
                                                    </div>
                                                    <div className="et-row">
                                                        {getDeviceIcon(item.deviceStr)}
                                                        <span className="et-device">
                                                            {item.deviceStr}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
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
