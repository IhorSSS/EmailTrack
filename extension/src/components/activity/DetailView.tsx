import { useState } from 'react';
import { Badge } from '../common/Badge';
import { formatRecipient, formatFullDate, getDeviceLabel } from '../../utils/formatter';
import { RefreshButton } from '../common/RefreshButton';
import { logger } from '../../utils/logger';
import type { TrackedEmail, OpenEvent } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { DashboardService } from '../../services/DashboardService';
import styles from './DetailView.module.css';
import { MapPin, Monitor, Smartphone, Globe } from 'lucide-react';

import type { TranslationKey } from '../../types/i18n';

interface DetailViewProps {
    email: TrackedEmail;
    onBack: () => void;
    onRefresh: () => void;
    loading: boolean;
}

interface DeviceInfo {
    device: string | null | undefined;
    os: string | null | undefined;
    browser: string | null | undefined;
    isBot: boolean;
    [key: string]: unknown;
}

export const DetailView = ({ email, onBack, onRefresh, loading }: DetailViewProps) => {
    const { t, language } = useTranslation();
    const { authToken } = useAuth();
    const [opens, setOpens] = useState<OpenEvent[]>(email.opens || []);
    const [page, setPage] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState((email.openCount || 0) > (email.opens?.length || 0));

    const OPENS_PAGE_SIZE = 50;

    const loadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const res = await DashboardService.getEmailOpens(email.id, nextPage, OPENS_PAGE_SIZE, authToken);
            if (res.data && res.data.length > 0) {
                setOpens(prev => [...prev, ...res.data]);
                setPage(nextPage);
                setHasMore(opens.length + res.data.length < res.total);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            logger.error('Failed to load more opens', err);
        } finally {
            setLoadingMore(false);
        }
    };

    // Determine locale for formatting
    const localeMap: Record<string, string> = {
        'en': 'en-US',
        'uk': 'uk-UA'
    };
    const currentLocale = language === 'system' ? navigator.language : (localeMap[language] || 'en-US');

    const getDeviceIcon = (deviceStr: string) => {
        const lower = (deviceStr || '').toLowerCase();
        if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')) {
            return <Smartphone size={14} className={styles.icon} />;
        }
        return <Monitor size={14} className={styles.icon} />;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button onClick={onBack} className={styles.backBtn}>
                    ← {t('detail_back')}
                </button>
                <h3 className={styles.title}>{t('detail_title')}</h3>
                <RefreshButton
                    onClick={onRefresh}
                    loading={loading}
                    title={t('detail_refresh_tooltip')}
                />
            </div>

            <div className={styles.content}>
                <div className="section">
                    <label className={styles.label}>{t('detail_recipient')}</label>
                    <div className={styles.value}>
                        {formatRecipient(email.recipient, t as (key: TranslationKey, params?: Record<string, string>) => string)}
                    </div>
                </div>

                {email.cc && (
                    <div className={styles.section}>
                        <label className={styles.label}>{t('label_cc')}</label>
                        <div className={styles.value}>
                            {formatRecipient(email.cc, t as (key: TranslationKey, params?: Record<string, string>) => string)}
                        </div>
                    </div>
                )}

                {email.bcc && (
                    <div className={styles.section}>
                        <label className={styles.label}>{t('label_bcc')}</label>
                        <div className={styles.value}>
                            {formatRecipient(email.bcc, t as (key: TranslationKey, params?: Record<string, string>) => string)}
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <label className={styles.label}>{t('detail_subject')}</label>
                    <div className={styles.value}>
                        {email.subject || t('detail_no_subject')}
                    </div>
                </div>

                {email.body && (
                    <div className={styles.section}>
                        <label className={styles.label}>{t('detail_body_preview')}</label>
                        <div className={`${styles.value} ${styles.previewBody}`}>
                            {email.body}
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <label className={styles.label}>{t('detail_sent_at')}</label>
                    <div className={styles.valueSmall}>
                        {formatFullDate(email.createdAt, currentLocale)}
                    </div>
                </div>

                <div>
                    <div className={styles.historyHeader}>
                        <label className={`${styles.label} ${styles.historyLabel}`}>{t('detail_open_history')}</label>
                        {email.openCount > 0 && (
                            <Badge variant="success" shape="pill">{email.openCount}</Badge>
                        )}
                    </div>
                    {(!opens || opens.length === 0) ? (
                        <div className={styles.emptyState}>
                            {t('detail_no_opens')}
                        </div>
                    ) : (
                        <div className={styles.opensList}>
                            {opens.map((open: OpenEvent, idx: number) => {
                                // Parse device JSON
                                let deviceInfo: DeviceInfo = { device: null, os: null, browser: null, isBot: false };
                                try {
                                    if (open.device && open.device.startsWith('{')) {
                                        const parsed = JSON.parse(open.device);
                                        deviceInfo = { ...deviceInfo, ...parsed };
                                    } else if (open.device) {
                                        deviceInfo.device = open.device;
                                    }
                                } catch (e) {
                                    logger.warn('Failed to parse device:', e);
                                    deviceInfo.device = open.device;
                                }

                                const hasOsOrBrowser = (deviceInfo.os && deviceInfo.os !== 'Unknown') || (deviceInfo.browser && deviceInfo.browser !== 'Unknown');
                                const label = getDeviceLabel(deviceInfo as Record<string, string>, t as (key: TranslationKey, params?: Record<string, string>) => string);

                                return (
                                    <div
                                        key={open.id || idx}
                                        className={styles.openItem}
                                    >
                                        <div className={styles.openRow}>
                                            <Badge variant="success">{t('detail_opened')}</Badge>
                                            <span className={styles.openTimestamp}>
                                                {formatFullDate(open.openedAt || open.timestamp || new Date().toISOString(), currentLocale)}
                                            </span>
                                        </div>

                                        {/* Device Details */}
                                        <div className={styles.openDetails}>
                                            <div className={styles.detailRow}>
                                                <span className={styles.detailIcon}>
                                                    {getDeviceIcon(deviceInfo.device || label)}
                                                </span>
                                                <span className={styles.detailText}>
                                                    {label}
                                                    {deviceInfo.isBot && (
                                                        <Badge variant="warning" shape="square" className={styles.botBadge}>
                                                            {t('detail_bot')}
                                                        </Badge>
                                                    )}
                                                </span>
                                            </div>
                                            {hasOsOrBrowser && (
                                                <div className={styles.detailRow}>
                                                    <span className={styles.detailIcon}>
                                                        <Globe size={14} className={styles.icon} />
                                                    </span>
                                                    <span className={styles.detailText}>
                                                        {deviceInfo.os || t('os_unknown')} • {deviceInfo.browser || t('browser_unknown')}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={styles.detailRow}>
                                                <span className={styles.detailIcon}>
                                                    <MapPin size={14} className={styles.icon} />
                                                </span>
                                                <span className={styles.detailText}>
                                                    {open.location || t('location_unknown')} • {open.ip || t('location_na')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {hasMore && (
                                <button 
                                    className={styles.loadMoreBtn} 
                                    onClick={loadMore} 
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? t('loading' as TranslationKey) || 'Loading...' : t('detail_load_more' as TranslationKey) || 'Load More'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
