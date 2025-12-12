import { prisma } from '../db';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

export async function recordOpen(trackId: string, ip: string, userAgent: string, quoted?: string) {
    try {
        // CRITICAL FILTER: Check if this is a quoted/historical pixel
        if (quoted === '1') {
            console.log(`[TRACK] Ignoring quoted pixel open: ${trackId} (from thread history)`);
            return; // Skip recording - this prevents thread bleed
        }

        console.log(`[TRACK] Recording open for ${trackId} from ${ip}`);
        console.log(`[TRACK] Raw User Agent: ${userAgent}`);

        let targetUA = userAgent;

        // Detect Gmail Proxy
        const isGmailProxy = userAgent.includes('GoogleImageProxy');
        const isMicrosoftBot = userAgent.includes('Microsoft Preview') || userAgent.includes('Edge/12'); // Example signature

        const parser = new UAParser(targetUA);
        const result = parser.getResult();

        let deviceType = result.device.type || 'Desktop';
        let deviceVendor = result.device.vendor || '';
        let deviceModel = result.device.model || '';
        let browserName = result.browser.name || '';
        let browserVersion = result.browser.version || '';
        let osName = result.os.name || '';
        let osVersion = result.os.version || '';

        // Clean up "Firefox 11 on Windows XP" from Google Proxy
        if (isGmailProxy) {
            deviceVendor = 'Google';
            deviceModel = 'Proxy/Server';
            browserName = 'Gmail Image Proxy';
            browserVersion = '';
            osName = 'Cloud';
            osVersion = '';
            deviceType = 'Server';
        }

        // Construct readable strings
        const device = (deviceVendor || deviceModel) ? `${deviceVendor} ${deviceModel}`.trim() : 'Desktop';
        const os = (osName) ? `${osName} ${osVersion}`.trim() : 'Unknown OS';
        const browser = (browserName) ? `${browserName} ${browserVersion}`.trim() : 'Unknown Browser';

        const geo = geoip.lookup(ip);
        const location = geo ? `${geo.city ? geo.city + ', ' : ''}${geo.country}` : 'Unknown Location';

        const fullDeviceObj = {
            device: device,
            os: os,
            browser: browser,
            type: deviceType,
            isBot: isGmailProxy || isMicrosoftBot,
            raw: userAgent
        };

        // 3. Save to DB
        // Deduplication Logic:
        // We fetch the LATEST open event for this email.
        // If it exists, and is from the same IP + UA, and is within 60 seconds, we ignore it.
        // This effectively debounces rapid-fire requests (bots, refreshes) but captures distinct opens.

        const lastEvent = await prisma.openEvent.findFirst({
            where: { trackedEmailId: trackId },
            orderBy: { openedAt: 'desc' }
        });

        const DEBOUNCE_WINDOW_MS = 10 * 1000; // 10 seconds (User requested to capture re-opens)
        const now = new Date();

        if (lastEvent) {
            const timeDiff = now.getTime() - lastEvent.openedAt.getTime();
            const sameActor = lastEvent.ip === ip && lastEvent.userAgent === userAgent;

            if (sameActor && timeDiff < DEBOUNCE_WINDOW_MS) {
                console.log(`[TRACK] Debounced event for ${trackId} (too soon: ${timeDiff}ms)`);
                return; // SKIP saving
            }
        }

        let email = await prisma.trackedEmail.findUnique({
            where: { id: trackId }
        });

        if (!email) {
            console.warn(`[TRACK] Track ID ${trackId} not found. Lazy registering...`);
            try {
                // Schema has no User relation, so we just create the email record.
                email = await prisma.trackedEmail.create({
                    data: {
                        id: trackId,
                        subject: '(Subject Unavailable - Registration Failed)',
                        recipient: 'Unknown'
                    }
                });
                console.log('[TRACK] Lazy registration successful for', trackId);
            } catch (createErr) {
                console.error('[TRACK] Lazy registration failed', createErr);
            }
        }

        // Re-check email existence
        if (email) {
            console.log(`[TRACK] Email found/created: ${trackId}. Creating OpenEvent...`);
            // ... existing create logic
            await prisma.openEvent.create({
                data: {
                    trackedEmailId: trackId,
                    ip: ip,
                    userAgent: userAgent,
                    device: JSON.stringify(fullDeviceObj),
                    location: location
                }
            });
            console.log(`[TRACK] OpenEvent created for ${trackId}`);
        }

    } catch (error) {
        console.error('Error recording open:', error);
    }
}
