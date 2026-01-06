import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Monitor, Smartphone, Clock, RefreshCw, ChevronDown } from 'lucide-react';
import { getDeviceLabel } from '../../utils/formatter';
import './StatsDisplay.css';
import { theme } from '../../config/theme';
import { CONSTANTS } from '../../config/constants';
import { useTranslation } from '../../hooks/useTranslation';

interface StatsDisplayProps {
    trackId: string;
    senderHint?: string;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ trackId, senderHint }) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // New state for manual refresh
    const [showDetails, setShowDetails] = useState(false);
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set()); // Track expanded groups
    const badgeRef = useRef<HTMLSpanElement>(null);

    const [contextInvalidated, setContextInvalidated] = useState(false);

    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('system');

    const fetchStats = (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            // Check if runtime exists (basic invalidation check)
            if (!chrome.runtime?.id) throw new Error("Extension context invalidated");

            // Fetch Stats AND Theme preference
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

            // Load theme from SYNC storage (where settings page saves it)
            if (chrome.storage.sync) {
                chrome.storage.sync.get(['theme'], (result) => {
                    const loadedTheme = result.theme as 'light' | 'dark' | 'system';
                    if (loadedTheme) setCurrentTheme(loadedTheme);
                });
            } else {
                // Fallback for environments where sync might be mocked or missing
                chrome.storage.local.get(['theme'], (result) => {
                    const loadedTheme = result.theme as 'light' | 'dark' | 'system';
                    if (loadedTheme) setCurrentTheme(loadedTheme);
                });
            }

        } catch (e: any) {
            const msg = e?.message || '';
            if (msg.includes('context invalidated') || msg.includes('Extension context invalidated')) {
                setContextInvalidated(true);
            }
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Listen for Theme Changes Live
    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'sync' && changes.theme) {
                const newTheme = changes.theme.newValue as 'light' | 'dark' | 'system';
                if (newTheme) setCurrentTheme(newTheme);
            }
        };

        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(handleStorageChange);
        }
        return () => {
            if (chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.removeListener(handleStorageChange);
            }
        }
    }, []);

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
            <div className="email-track-stats-container" data-theme="system">
                <span
                    className="email-track-badge error"
                    title={t('status_extension_updated')}
                    style={{ cursor: 'help', whiteSpace: 'nowrap' }}
                >
                    ⚠️ {t('status_reload')}
                </span>
            </div>
        );
    }

    if (loading) return <span className="email-track-badge loading">...</span>;

    // OWNERSHIP CHECK: If 404, email might not be opened yet or registration is pending.
    // We show 'Tracked' as fallback instead of hiding the badge.
    const isNotFound = stats && (stats as any).status === 404;

    // OFFLINE / NOT FOUND FIX: Show "Tracked" as fallback
    const effectiveStats = (isNotFound || !stats || (stats as any).error) ? { opens: [] } : stats;

    const openCount = Array.isArray(effectiveStats.opens) ? effectiveStats.opens.length : (typeof effectiveStats.opens === 'number' ? effectiveStats.opens : 0);

    // Better localized open text:

    const displayOpenText = openCount > 0 ? `${openCount} ${t('detail_opened')}` : (isNotFound ? t('dashboard_tracked') : t('detail_sent_at'));

    const statusClass = openCount > 0 ? 'opened' : 'sent';

    const getDeviceIcon = (deviceStr: string) => {
        const lower = (deviceStr || '').toLowerCase();
        if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) return <Smartphone className="et-icon" />;
        return <Monitor className="et-icon" />;
    };

    const formatLocation = (loc: string) => {
        if (!loc) return t('location_unknown');
        if (loc.startsWith(', ')) return loc.substring(2);
        return loc;
    };

    return (
        <>
            <div className="email-track-stats-container" data-theme={currentTheme}>
                <span
                    ref={badgeRef}
                    className={`email-track-badge ${statusClass}`}
                    onClick={toggleDetails}
                    title={t('detail_open_history')}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    {openCount > 0 && <span className="dot"></span>}
                    {displayOpenText}

                    <button
                        className={`et-refresh-btn ${refreshing ? 'rotating' : ''}`}
                        onClick={handleRefresh}
                        title={t('detail_refresh_tooltip')}
                    >
                        <RefreshCw size={12} />
                    </button>
                </span>
            </div>

            {/* ... popup logic ... */}

            {showDetails && openCount > 0 && createPortal(
                <div className="email-track-portal-overlay" data-theme={currentTheme} onClick={closeDetails}>
                    <div
                        className="email-track-details-popup"
                        style={popupStyle}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="et-popup-header">
                            <h4>{t('detail_open_history')}</h4>
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
                                    const deviceStr = getDeviceLabel(deviceData, t); // t is already relaxed in formatter or we cast here if needed? 
                                    // t in StatsDisplay is from hooks/useTranslation which returns (key: TranslationKey) => string
                                    // formatter expects (key: string) => string. This is compatible in recent TS versions if strictFunctionTypes is off, or we need to cast.
                                    // Let's verify type.

                                    const isBot = deviceData.isBot || deviceData.device?.includes('Proxy') || deviceData.browser?.includes('Proxy');

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
                                    return <li className="et-timeline-item" style={{ justifyContent: 'center', color: theme.colors.text.muted }}>{t('detail_no_opens')}</li>;
                                }

                                return groupedEvents.map((open: any, index: number) => {
                                    const isExpanded = expandedGroups.has(index);
                                    const isGrouped = open.count > 1;

                                    // Localized date formatter
                                    const formatDate = (dateStr: string) => {
                                        const d = new Date(dateStr);
                                        // Fallback to en-US if navigator.language is undefined, though it usually is defined in browser
                                        const locale = navigator.language || 'en-US';
                                        return d.toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    };

                                    // Single item (not grouped)
                                    if (!isGrouped) {
                                        return (
                                            <li key={index} className="et-timeline-item">
                                                <div className="et-row">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                                        <Clock className="et-icon" size={14} style={{ color: theme.colors.info }} />
                                                        <span className="et-time">
                                                            {formatDate(open.openedAt)}
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
                                                            {formatDate(open.openedAt)}
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
                                                <span>{t('stats_grouped_opens', { count: open.count })}</span>
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
                                                                {formatDate(item.openedAt)}
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
