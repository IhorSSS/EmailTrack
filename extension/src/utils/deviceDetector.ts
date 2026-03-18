import React from 'react';
import { Monitor, Smartphone, Server } from 'lucide-react';

export type DeviceType = 'Desktop' | 'Mobile' | 'Server' | 'Unknown';

interface DeviceInfo {
    icon: React.ReactNode;
    type: DeviceType;
}

/**
 * Detects device type and icon from device string or user agent.
 * Centralized logic to avoid hardcoded strings in components.
 */
export const detectDevice = (deviceStr: string = ''): DeviceInfo => {
    const lower = deviceStr.toLowerCase();
    
    // Check for Server/Proxy first (Gmail Proxy)
    if (lower.includes('proxy') || lower.includes('server') || lower.includes('googleimageproxy')) {
        return {
            icon: React.createElement(Server, { className: 'et-icon' }),
            type: 'Server'
        };
    }

    // Check for Mobile
    if (
        lower.includes('mobile') || 
        lower.includes('iphone') || 
        lower.includes('android') || 
        lower.includes('phone') ||
        lower.includes('ipad')
    ) {
        return {
            icon: React.createElement(Smartphone, { className: 'et-icon' }),
            type: 'Mobile'
        };
    }

    // Default to Desktop if it's not mobile/server but has some content
    if (lower.includes('desktop') || lower.includes('windows') || lower.includes('macintosh') || lower.includes('linux')) {
        return {
            icon: React.createElement(Monitor, { className: 'et-icon' }),
            type: 'Desktop'
        };
    }

    // Fallback
    return {
        icon: React.createElement(Monitor, { className: 'et-icon' }),
        type: 'Desktop'
    };
};
