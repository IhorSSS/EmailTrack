import { prisma } from '../db';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

export async function recordOpen(trackId: string, ip: string, userAgent: string) {
    try {
        // ...
        // 2. Parse Info
        const parser = new UAParser(userAgent);
        const result = parser.getResult();
        const device = `${result.device.vendor || ''} ${result.device.model || ''}`.trim() || 'Desktop';
        const os = `${result.os.name || ''} ${result.os.version || ''}`.trim();
        const browser = `${result.browser.name || ''} ${result.browser.version || ''}`.trim();

        const geo = geoip.lookup(ip);
        const location = geo ? `${geo.city}, ${geo.country}` : 'Unknown';

        const fullDeviceObj = {
            device,
            os,
            browser,
            type: result.device.type
        };

        // 3. Save to DB
        // We check if TrackedEmail exists first to avoid foreign key error
        const email = await prisma.trackedEmail.findUnique({
            where: { id: trackId }
        });

        if (email) {
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
            // We need to match schema: device is String.
        } else {
            console.warn(`Track ID ${trackId} not found`);
        }

    } catch (error) {
        console.error('Error recording open:', error);
    }
}
