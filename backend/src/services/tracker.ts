import { prisma } from '../db';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

export async function recordOpen(trackId: string, ip: string, userAgent: string) {
    try {
        // ...
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
        const email = await prisma.trackedEmail.findUnique({
            where: { id: trackId }
        });

        if (email) {
            // Deduplication logic: Check if we have an event from same IP in last 60 seconds?
            // For now, let's just record everything but label it correctly. 
            // The UI can filter if needed.

            console.log(`[TRACK] Email found: ${trackId}. Creating OpenEvent...`);
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
        } else {
            console.warn(`[TRACK] ERROR: Track ID ${trackId} not found in database!`);
        }

    } catch (error) {
        console.error('Error recording open:', error);
    }
}
