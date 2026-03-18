
import { prisma } from '../db';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { logger } from '../utils/logger';
import { TRACKING_CONSTANTS } from '../config/constants';
import { TrackingMetadata } from '../types';

export class TrackerService {
    /**
     * Records an email open event.
     * @param trackId - The unique ID of the tracked email.
     * @param ip - The IP address of the requester.
     * @param userAgent - The User-Agent string of the requester.
     * @param pixelTimestamp - Optional timestamp from the tracking pixel URL.
     */
    static async recordOpen(trackId: string, ip: string, userAgent: string, pixelTimestamp?: string) {
        try {
            logger.info(`[TrackerService] Recording open for ${trackId} from ${ip}`);

            const { isBot, isGmailProxy, isMicrosoftBot } = this.detectBots(userAgent);
            const metadata = this.parseUserAgent(userAgent, isGmailProxy, isMicrosoftBot);
            const location = this.lookupLocation(ip);

            const lastEvent = await prisma.openEvent.findFirst({
                where: { trackedEmailId: trackId },
                orderBy: { openedAt: 'desc' }
            });

            if (lastEvent && this.isDuplicateEvent(lastEvent, ip, userAgent)) {
                logger.info(`[TrackerService] Debounced duplicate event for ${trackId}`);
                return;
            }

            let email = await prisma.trackedEmail.findUnique({
                where: { id: trackId }
            });

            if (!email) {
                email = await this.lazyRegisterEmail(trackId);
            }

            if (email) {
                await prisma.openEvent.create({
                    data: {
                        trackedEmailId: trackId,
                        ip: ip,
                        userAgent: userAgent,
                        device: JSON.stringify(metadata),
                        location: location
                    }
                });
                logger.info(`[TrackerService] OpenEvent created for ${trackId}`);
            }

        } catch (error) {
            logger.error(`[TrackerService] Error recording open for ${trackId}:`, error);
        }
    }

    private static detectBots(userAgent: string) {
        const isGmailProxy = userAgent.includes('GoogleImageProxy');
        const isBot = TRACKING_CONSTANTS.BOT_SIGNATURES.some(sig => userAgent.includes(sig));
        const isMicrosoftBot = !isGmailProxy && isBot;
        return { isBot, isGmailProxy, isMicrosoftBot };
    }

    private static parseUserAgent(userAgent: string, isGmailProxy: boolean, isMicrosoftBot: boolean): TrackingMetadata {
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        let deviceType = result.device.type || 'Desktop';
        let deviceVendor = result.device.vendor || '';
        let deviceModel = result.device.model || '';
        let browserName = result.browser.name || '';
        let browserVersion = result.browser.version || '';
        let osName = result.os.name || '';
        let osVersion = result.os.version || '';

        if (isGmailProxy) {
            deviceVendor = 'Google';
            deviceModel = 'Proxy/Server';
            browserName = 'Gmail Image Proxy';
            browserVersion = '';
            osName = 'Cloud';
            osVersion = '';
            deviceType = 'Server';
        }

        const device = (deviceVendor || deviceModel) ? `${deviceVendor} ${deviceModel}`.trim() : 'Desktop';
        const os = (osName) ? `${osName} ${osVersion}`.trim() : 'Unknown OS';
        const browser = (browserName) ? `${browserName} ${browserVersion}`.trim() : 'Unknown Browser';

        return {
            device: device,
            os: os,
            browser: browser,
            type: deviceType,
            isBot: isGmailProxy || isMicrosoftBot,
            raw: userAgent
        };
    }

    private static lookupLocation(ip: string): string {
        const geo = geoip.lookup(ip);
        return geo ? `${geo.city ? geo.city + ', ' : ''}${geo.country}` : 'Unknown Location';
    }

    private static isDuplicateEvent(lastEvent: { ip: string | null; userAgent: string | null; openedAt: Date }, ip: string, userAgent: string): boolean {
        const now = new Date();
        const timeDiff = now.getTime() - lastEvent.openedAt.getTime();
        const sameActor = lastEvent.ip === ip && lastEvent.userAgent === userAgent;
        return sameActor && timeDiff < TRACKING_CONSTANTS.WINDOWS.DEBOUNCE;
    }

    private static async lazyRegisterEmail(trackId: string) {
        logger.warn(`[TrackerService] Track ID ${trackId} not found. Lazy registering...`);
        try {
            return await prisma.trackedEmail.create({
                data: {
                    id: trackId,
                    subject: TRACKING_CONSTANTS.PLACEHOLDERS.SUBJECT_UNAVAILABLE,
                    recipient: TRACKING_CONSTANTS.PLACEHOLDERS.RECIPIENT_UNKNOWN
                }
            });
        } catch (createErr) {
            logger.error(`[TrackerService] Lazy registration failed for ${trackId}`, createErr);
            return null;
        }
    }
}
