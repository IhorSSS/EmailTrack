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

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // If logged in, link email to account
        if (userProfile && userProfile.id) {
            payload.ownerId = userProfile.id;
            logger.log('[Background] Cloud mode: adding ownerId', userProfile.id);

            // SECURITY: Get Sync Token to prove identity
            try {
                // We use non-interactive to check if we have a valid session
                const token = await new Promise<string | undefined>((resolve) => {
                    chrome.identity.getAuthToken({ interactive: false }, (token: any) => {
                        if (chrome.runtime.lastError || !token) {
                            logger.warn('[Background] Auth Token retrieval failed:', chrome.runtime.lastError?.message);
                            resolve(undefined);
                        } else {
                            resolve(token);
                        }
                    });
                });

                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    logger.log('[Background] Attached Auth Token to request');
                } else {
                    logger.error('[Background] CRITICAL: User is logged in but no token available. Aborting Cloud Registration to prevent data mismatch.');
                    // Option: Throw error or Fallback to Incognito? 
                    // decided: Throw error to alert user (via UI eventually) that sync is broken.
                    throw new Error("AUTH_TOKEN_MISSING");
                }
            } catch (e) {
                logger.error('[Background] Failed to get auth token:', e);
                // If strictly cloud mode, we might want to stop here. 
                // However, preserving data is important. 
                // Let's NOT send ownerId if auth failed, so it saves as incognito (safe fallback) or fail?
                // Logic decision: If we send with ownerId but NO token, backend might reject or warn.
                // Let's remove ownerId to be safe and save as Local/Incognito so data isn't lost.
                delete payload.ownerId;
                logger.log('[Background] Falling back to Incognito registration due to Auth failure.');
            }

        } else {
            logger.log('[Background] Incognito mode: failed to find ownerId or not logged in');
        }

        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Registration API failed: ${response.status} ${errorText}`);
        }

        if (data.user) {
            chrome.storage.local.set({ currentUser: data.user });
        }

        logger.log('Email registered successfully');
        // Return whether we successfully claimed it (synced) or just registered anonymously (unsynced/incognito)
        // If we attached ownerId, it's synced.
        const isSynced = !!payload.ownerId;
        return { success: true, synced: isSynced };
    } catch (err: any) {
        logger.error('Registration failed:', err);
        return { success: false, error: err.message };
    }
}

async function handleGetStats(trackId: string) {
    logger.log('Fetching stats for:', trackId);
    try {
        // Get auth token if available (for ownership validation)
        const headers: Record<string, string> = {};

        try {
            const token = await new Promise<string | undefined>((resolve) => {
                chrome.identity.getAuthToken({ interactive: false }, (token: any) => {
                    if (chrome.runtime.lastError || !token) {
                        resolve(undefined);
                    } else {
                        resolve(token);
                    }
                });
            });

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        } catch (e) {
            // Proceed without auth (public access mode)
        }

        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STATS}/${trackId}`, {
            headers
        });

        // Return status code to frontend so it can hide badge on 404 (deleted/not owned)
        if (!res.ok) {
            return { error: `HTTP ${res.status}`, status: res.status };
        }

        const data = await res.json();
        return { ...data, status: 200 };
    } catch (err: any) {
        logger.error('Stats fetch error:', err);
        return { error: err.message || 'Unknown error', status: 0 };
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'REGISTER_EMAIL') {
        handleRegister(message.data).then((result) => sendResponse(result));
        return true; // Keep channel open
    } else if (message.type === 'GET_STATS') {
        handleGetStats(message.trackId).then(sendResponse);
        return true; // Keep channel open for async response
    }
});
