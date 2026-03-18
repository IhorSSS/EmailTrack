import React, { useEffect, useState, useRef, useCallback } from 'react';
import './StatsDisplay.css';
import { CONSTANTS } from '../../../config/constants';
import { useTranslation } from '../../../hooks/useTranslation';
import { processStatsEvents } from '../../../utils/statsProcessor';
import { detectDevice } from '../../../utils/deviceDetector';
import { StatsBadge } from './StatsBadge';
import { StatsPortal } from './StatsPortal';

interface StatsDisplayProps {
    trackId: string;
    senderHint?: string;
}

interface EmailStats {
    status?: number;
    error?: string;
    opens: Array<Record<string, unknown>> | number;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ trackId, senderHint }) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<EmailStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [contextInvalidated, setContextInvalidated] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('system');
    const badgeRef = useRef<HTMLSpanElement>(null);

    const fetchStats = useCallback((isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            if (!chrome.runtime?.id) throw new Error("Extension context invalidated");

            chrome.runtime.sendMessage({
                type: CONSTANTS.MESSAGES.GET_STATS,
                trackId,
                senderHint
            }, (response: EmailStats) => {
                const lastError = chrome.runtime?.lastError;
                if (lastError) {
                    if (lastError.message?.includes('context invalidated')) {
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

            if (chrome.storage.sync) {
                chrome.storage.sync.get([CONSTANTS.STORAGE_KEYS.THEME], (result) => {
                    const loadedTheme = result[CONSTANTS.STORAGE_KEYS.THEME] as 'light' | 'dark' | 'system';
                    if (loadedTheme) setCurrentTheme(loadedTheme);
                });
            }
        } catch (err: unknown) {
            const e = err as Error;
            if (e.message?.includes('context invalidated')) {
                setContextInvalidated(true);
            }
            setLoading(false);
            setRefreshing(false);
        }
    }, [trackId, senderHint]);

    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'sync' && changes[CONSTANTS.STORAGE_KEYS.THEME]) {
                const newTheme = changes[CONSTANTS.STORAGE_KEYS.THEME].newValue as 'light' | 'dark' | 'system';
                if (newTheme) setCurrentTheme(newTheme);
            }
        };
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    useEffect(() => {
        fetchStats();
    }, [trackId, fetchStats]);

    const handleRefresh = (e: React.MouseEvent) => {
        e.stopPropagation();
        fetchStats(true);
    };

    const toggleDetails = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (openCount > 0) {
            if (!showDetails && badgeRef.current) {
                const rect = badgeRef.current.getBoundingClientRect();
                const { POPUP } = CONSTANTS;
                const spaceBelow = window.innerHeight - rect.bottom;
                const style: React.CSSProperties = { left: rect.left };

                if (spaceBelow >= CONSTANTS.LAYOUT.STATS_MIN_SPACE) {
                    style.top = rect.bottom + POPUP.OFFSET;
                } else {
                    style.bottom = window.innerHeight - rect.top + POPUP.OFFSET;
                }

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
    };

    const toggleGroup = (index: number) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    if (contextInvalidated) {
        return (
            <div className="email-track-stats-container" data-theme="system">
                <span className="email-track-badge error et-cursor-help et-no-wrap" title={t('status_extension_updated')}>
                    ⚠️ {t('status_reload')}
                </span>
            </div>
        );
    }

    if (loading) return <span className="email-track-badge loading">...</span>;

    const isNotFound = stats && stats.status === 404;
    const effectiveStats: EmailStats = (isNotFound || !stats || stats.error) ? { opens: [] } : stats;
    const openCount = Array.isArray(effectiveStats.opens) ? effectiveStats.opens.length : (typeof effectiveStats.opens === 'number' ? effectiveStats.opens : 0);
    const displayOpenText = openCount > 0 ? `${openCount} ${t('detail_opened')}` : (isNotFound ? t('dashboard_tracked') : t('detail_sent_at'));
    const statusClass = openCount > 0 ? 'opened' : 'sent';

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        // Use system locale or fallback to English, localized via Intl
        return new Intl.DateTimeFormat(navigator.language || 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    };

    const groupedEvents = processStatsEvents(Array.isArray(stats?.opens) ? stats?.opens : [], t);

    return (
        <div className="email-track-stats-container" data-theme={currentTheme}>
            <StatsBadge
                statusClass={statusClass}
                toggleDetails={toggleDetails}
                openCount={openCount}
                displayOpenText={displayOpenText}
                refreshing={refreshing}
                handleRefresh={handleRefresh}
                title={t('detail_open_history')}
                refreshTitle={t('detail_refresh_tooltip')}
                badgeRef={badgeRef}
            />
            <StatsPortal
                showDetails={showDetails}
                currentTheme={currentTheme}
                closeDetails={closeDetails}
                popupStyle={popupStyle}
                title={t('detail_open_history')}
                groupedEvents={groupedEvents}
                expandedGroups={expandedGroups}
                toggleGroup={toggleGroup}
                formatDate={formatDate}
                getDeviceIcon={(deviceStr) => detectDevice(deviceStr).icon}
                t_no_opens={t('detail_no_opens')}
                t_grouped_opens_fn={(count) => t('stats_grouped_opens', { count: String(count) })}
            />
        </div>
    );
};

export default StatsDisplay;
