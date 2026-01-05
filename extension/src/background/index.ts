import { logger } from '../utils/logger';
import { API_CONFIG } from '../config/api';
import { LocalStorageService } from '../services/LocalStorageService';

logger.log('EmailTrack: Background Script Loaded');

// --- RETRY LOGIC (OUTBOX) ---

async function processOutbox() {
    logger.log('[Outbox] Processing pending registrations...');
    try {
        const emails = await LocalStorageService.getEmails();
        const unsynced = emails.filter(e => !e.synced);

        if (unsynced.length === 0) {
            logger.log('[Outbox] No pending registrations.');
            return;
        }

        logger.log(`[Outbox] Found ${unsynced.length} pending emails. Retrying...`);

        for (const email of unsynced) {
            try {
                const result = await handleRegister(email);
                if (result.success) {
                    await LocalStorageService.markAsSynced([email.id]);
                    logger.log(`[Outbox] Successfully registered ${email.id}`);
                }
            } catch (err) {
                logger.error(`[Outbox] Failed to retry ${email.id}:`, err);
                // Continue to next email
            }
        }
    } catch (err) {
        logger.error('[Outbox] Critical error in processing:', err);
    }
}

// Set up periodic retry (every 5 minutes)
chrome.alarms.create('retry_registration', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'retry_registration') {
        processOutbox();
    }
});

// Also try to process on startup
chrome.runtime.onStartup.addListener(() => {
    logger.log('[Background] Run onStartup tasks');
    processOutbox();
});

async function handleRegister(data: any) {
    logger.log('Registering email:', data);

    // Proactively try to process any pending items first
    processOutbox().catch(() => { });

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
            cc: data.cc,
            bcc: data.bcc,
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
        // Return success so the content script (or outbox) can mark it as synced.
        // It's 'synced' if it successfully reached the backend.
        return { success: true, synced: true };
    } catch (err: any) {
        logger.error('Registration failed:', err);
        return { success: false, error: err.message };
    }
}

async function handleGetStats(trackId: string, senderHint?: string) {
    logger.log('Fetching stats for:', trackId, 'senderHint:', senderHint);
    try {
        // 1. Check if we *should* satisfy this request as an authenticated user
        const storageData = await chrome.storage.local.get(['userProfile']);
        const userProfile = storageData.userProfile as { id: string; email: string } | undefined;

        // Get auth token if available (for ownership validation)
        const headers: Record<string, string> = {};

        // Pass sender hint for incognito / local ownership validation on backend
        if (senderHint) {
            headers['x-sender-hint'] = senderHint;
        }

        let token: string | undefined;

        try {
            token = await new Promise<string | undefined>((resolve) => {
                chrome.identity.getAuthToken({ interactive: false }, (t: any) => {
                    if (chrome.runtime.lastError || !t) {
                        resolve(undefined);
                    } else {
                        resolve(t);
                    }
                });
            });
        } catch (e) {
            // Ignore error
        }

        if (userProfile) {
            // LOGGED IN MODE: Strict Security
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            } else {
                // User is supposedly logged in, but we can't get a token.
                // WE MUST NOT FALLBACK TO PUBLIC ACCESS.
                // Doing so would allow a logged-in user (with a broken token) to see "incognito" (unowned) stats
                // which might belong to another user on the same machine.
                logger.warn('[Background] Logged in but no token. Blocking public fallback.');
                return { error: 'Auth Required', status: 401 };
            }
        } else {
            // INCOGNITO MODE: Public Access
            // We allow requests without token, but only for incognito data.
            // (Backend enforces owner-mismatch if it turns out the email IS owned)
            if (token) headers['Authorization'] = `Bearer ${token}`; // Attach if accidentally available? No harm.
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
        handleGetStats(message.trackId, message.senderHint).then(sendResponse);
        return true; // Keep channel open for async response
    }
});
