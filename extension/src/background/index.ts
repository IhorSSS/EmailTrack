// Service Worker Background Script
import { logger } from '../utils/logger';
import { API_CONFIG } from '../config/api';

logger.log('EmailTrack: Background Script Loaded');

async function handleRegister(data: any) {
    logger.log('Registering email:', data);
    try {
        await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: data.id,
                subject: data.subject,
                recipient: data.recipient,
                body: data.body, // Send body snippet
                user: data.user  // Send sender email
            })
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
