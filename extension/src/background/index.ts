// Service Worker Background Script
import { logger } from '../utils/logger';
import { API_CONFIG } from '../config/api';

logger.log('EmailTrack: Background Script Loaded');

async function handleRegister(data: any) {
    logger.log('Registering email:', data);
    try {
        // Check if user is logged in (Cloud mode)
        // Use local storage as it is more reliable for extension communication
        const storageData = await chrome.storage.local.get(['userProfile']);
        const userProfile = storageData.userProfile as { id: string; email: string } | undefined;

        logger.log('[Background] Storage Data:', JSON.stringify(storageData));
        logger.log('[Background] Extracted UserProfile:', JSON.stringify(userProfile));

        const payload: any = {
            id: data.id,
            subject: data.subject,
            recipient: data.recipient,
            body: data.body,
            user: data.user
        };

        // If logged in, link email to account
        if (userProfile && userProfile.id) {
            payload.ownerId = userProfile.id;
            logger.log('[Background] Cloud mode: adding ownerId', userProfile.id);
        } else {
            logger.log('[Background] Incognito mode: failed to find ownerId or not logged in');
        }

        await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Cache the current user for the Popup to use
        if (data.user) {
            chrome.storage.local.set({ currentUser: data.user });
        }

        logger.log('Email registered successfully');
    } catch (err) {
        logger.error('Registration failed:', err);
    }
}

async function handleGetStats(trackId: string) {
    logger.log('Fetching stats for:', trackId);
    try {
        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STATS}/${trackId}`);
        if (!res.ok) throw new Error('Stats fetch failed');
        const data = await res.json();
        return data;
    } catch (err: any) {
        logger.error('Stats fetch error:', err);
        return { error: err.message || 'Unknown error' };
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'REGISTER_EMAIL') {
        handleRegister(message.data).then(() => sendResponse({ success: true }));
        return true; // Keep channel open
    } else if (message.type === 'GET_STATS') {
        handleGetStats(message.trackId).then(sendResponse);
        return true; // Keep channel open for async response
    }
});
