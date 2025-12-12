import { prisma } from '../db';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

export async function recordOpen(trackId: string, ip: string, userAgent: string) {
    try {
        // ...
        console.log(`[TRACK] Raw User Agent: ${userAgent}`);

        let targetUA = userAgent;
        // Gmail Proxy sometimes puts the real UA in Via or X-Forwarded-For, but mostly standard UA is GoogleImageProxy.
        // However, if we see "GoogleImageProxy", we know it's Gmail.

        const parser = new UAParser(targetUA);
        const result = parser.getResult();

        const deviceType = result.device.type || 'Desktop';
        const deviceVendor = result.device.vendor || '';
        const deviceModel = result.device.model || '';

        // Construct readable strings, avoid "undefined"
        const device = (deviceVendor || deviceModel) ? `${deviceVendor} ${deviceModel}`.trim() : 'Desktop';
        const os = (result.os.name) ? `${result.os.name} ${result.os.version || ''}`.trim() : 'Unknown OS';
        const browser = (result.browser.name) ? `${result.browser.name} ${result.browser.version || ''}`.trim() : 'Unknown Browser';

        const geo = geoip.lookup(ip);
        const location = geo ? `${geo.city ? geo.city + ', ' : ''}${geo.country}` : 'Unknown Location';

        const fullDeviceObj = {
            device: device,
            os: os,
            browser: browser,
            type: deviceType,
            raw: userAgent // Store raw for debug
        };

        // 3. Save to DB
        // We check if TrackedEmail exists first to avoid foreign key error
        const email = await prisma.trackedEmail.findUnique({
            where: { id: trackId }
        });

        if (email) {
            console.log(`[TRACK] Email found: ${trackId}. Creating OpenEvent...`);
            await prisma.openEvent.create({
                data: {
                    trackedEmailId: trackId,
                    ip: ip,
                    userAgent: userAgent,
                    device: JSON.stringify(fullDeviceObj), // Storing detailed info as string or we can simplify
                    // Schema has 'device' as String. I will store a human readable string or JSON. 
                    // Let's store human readable: "Chrome 90 on Windows 10"
                    // I will change logic:
                    location: location
                }
            });
            console.log(`[TRACK] OpenEvent created for ${trackId}`);
            // We need to match schema: device is String.
        } else {
            console.warn(`[TRACK] ERROR: Track ID ${trackId} not found in database!`);
        }

    } catch (error) {
        console.error('Error recording open:', error);
    }
}
