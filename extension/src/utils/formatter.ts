
import { logger } from './logger';

/**
 * Tries to parse the recipient field.
 * The backend might return a JSON string like:
 * '[{"name":"Example","address":"example@gmail.com"}]'
 * or just a plain string.
 */
export const formatRecipient = (recipientRaw: string, t?: (key: string) => string): string => {
    if (!recipientRaw) return t ? t('recipient_unknown') : 'Unknown Recipient';

    try {
        // Check if it looks like JSON
        if (recipientRaw.trim().startsWith('[')) {
            const parsed = JSON.parse(recipientRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const first = parsed[0];
                if (first.name && first.name !== first.address) {
                    return `${first.name} <${first.address}>`; // Standard email format, safe to concatenate
                }
                return first.address || first.name || (t ? t('recipient_unknown') : 'Unknown');
            }
        }
    } catch (e) {
        // If parse fails, fall back to returning raw string
        logger.warn('Failed to parse recipient:', e);
    }

    // Fallback: remove any array brackets if they exist as string text but failed parse
    return recipientRaw.replace(/[\[\]"]/g, '');
};

// Helper to avoid circular deps: we pass `locale` from components
export const formatDateTime = (dateStr: string, locale: string = 'en-US'): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();

    // Reset time to midnight for comparison to determine relative day
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const timeStr = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);

    // Use Intl.RelativeTimeFormat for "Today", "Yesterday"
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (diffDays === 0 || diffDays === -1) {
        // "Today" or "Yesterday"
        const relativeDay = rtf.format(diffDays, 'day');
        // Capitalize first letter as it might be lowercased by Intl in some locales depending on context,
        // though usually standalone it is fine. But for consistency with UI:
        const capitalizedRelativeDay = relativeDay.charAt(0).toUpperCase() + relativeDay.slice(1);
        return `${capitalizedRelativeDay}, ${timeStr}`;
    } else {
        const dateStrLocalized = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
        return `${dateStrLocalized}, ${timeStr}`;
    }
};

export const formatFullDate = (dateStr: string, locale: string = 'en-US'): string => {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(dateStr));
};

export const getDeviceLabel = (deviceData: any, t: (key: any, params?: any) => string): string => {
    // 1. Check if it's a bot/proxy
    const isBot = deviceData.isBot ||
        deviceData.device?.includes('Proxy') ||
        deviceData.browser?.includes('Proxy') ||
        deviceData.device === 'Google Proxy/Server' ||
        deviceData.device === 'Gmail Image Proxy'; // Explicit match

    if (isBot) {
        // Standardize Gmail Proxy label
        if (deviceData.os === 'Windows XP' && deviceData.browser?.includes('Firefox 11')) {
            return t('device_gmail');
        } else if (deviceData.raw?.includes('GoogleImageProxy') || deviceData.device?.includes('GoogleImageProxy')) {
            return t('device_gmail');
        } else if (deviceData.device?.includes('Google') && deviceData.device?.includes('Proxy')) {
            return t('device_gmail');
        } else if (deviceData.device === 'Gmail Image Proxy') {
            return t('device_gmail');
        } else {
            return t('device_proxy');
        }
    }

    // 2. Real Device
    if (deviceData.browser || deviceData.os) {
        const osName = deviceData.os || t('os_unknown');
        const browserName = deviceData.browser || t('browser_unknown');
        return t('device_details', { browser: browserName, os: osName });
    }

    // 3. Fallback
    return deviceData.device || t('device_unknown');
};
