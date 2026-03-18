import { getDeviceLabel } from './formatter';
import { CONSTANTS } from '../config/constants';
import type { TranslationKey } from '../types/i18n';

export interface ProcessedEvent extends Record<string, unknown> {
    deviceStr: string;
    isBot: boolean;
    location: string;
    timestamp: number;
    count?: number;
    items?: ProcessedEvent[];
    openedAt?: string;
}

export const formatLocation = (loc: string, t: (key: TranslationKey, params?: Record<string, string>) => string) => {
    if (!loc) return t('location_unknown');
    if (loc.startsWith(', ')) return loc.substring(2);
    return loc;
};

export const processStatsEvents = (
    rawOpens: Array<Record<string, unknown>> | undefined,
    t: (key: TranslationKey, params?: Record<string, string>) => string
): ProcessedEvent[] => {
    if (!rawOpens || !Array.isArray(rawOpens)) return [];

    // 1. Process Raw Events
    const processedEvents = rawOpens.map((open): ProcessedEvent => {
        let deviceData: Record<string, unknown> = {};
        try {
            if (typeof open.device === 'string' && open.device.startsWith('{')) {
                deviceData = JSON.parse(open.device);
            } else {
                deviceData = { device: open.device };
            }
        } catch {
            deviceData = { device: open.device };
        }

        // Determine Label
        const deviceStr = getDeviceLabel(deviceData as Record<string, string>, t as (key: string, params?: Record<string, string>) => string);

        const isBot = Boolean(deviceData.isBot) || 
            (typeof deviceData.device === 'string' && deviceData.device.includes('Proxy')) || 
            (typeof deviceData.browser === 'string' && deviceData.browser.includes('Proxy'));

        return {
            ...open,
            deviceStr,
            isBot,
            location: formatLocation(open.location as string || '', t),
            timestamp: new Date(open.openedAt as string || 0).getTime()
        } as ProcessedEvent;
    });

    // 2. Group Consecutive Similar Events
    const groupedEvents: ProcessedEvent[] = [];
    processedEvents.forEach((current: ProcessedEvent) => {
        const last = groupedEvents[groupedEvents.length - 1];
        
        // Using a grouping window for "spammy" reloads
        const isSame = last &&
            last.deviceStr === current.deviceStr &&
            last.location === current.location &&
            (last.timestamp - current.timestamp < CONSTANTS.GROUPING_WINDOW_MS); 

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

    return groupedEvents;
};
