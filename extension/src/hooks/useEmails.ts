import { useState, useCallback, useEffect } from 'react';
import { API_CONFIG } from '../config/api';
import { LocalStorageService } from '../services/LocalStorageService';
import { DashboardService } from '../services/DashboardService';
import { logger } from '../utils/logger';
import type { TrackedEmail } from '../types';
import type { UserProfile } from '../services/AuthService';

export interface EmailStats {
    tracked: number;
    opened: number;
    rate: number;
}

export const useEmails = (userProfile: UserProfile | null, currentUser: string | null, authToken: string | null, settingsLoaded: boolean = true) => {
    const [emails, setEmails] = useState<TrackedEmail[]>([]);
    const [stats, setStats] = useState<EmailStats>({ tracked: 0, opened: 0, rate: 0 });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const processPendingDeletes = async () => {
        try {
            const pending = await LocalStorageService.getPendingDeletes();
            if (pending.length > 0) {
                logger.log(`[SYNC] Processing ${pending.length} pending delete requests...`);
                // Assume API_CONFIG is imported or passed
                const urlBase = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}`;

                const remaining: { ids: string[], user?: string }[] = [];

                for (const task of pending) {
                    try {
                        const params = new URLSearchParams();
                        params.append('ids', task.ids.join(','));
                        if (task.user) params.append('user', task.user);

                        const res = await fetch(`${urlBase}?${params.toString()}`, { method: 'DELETE' });
                        if (!res.ok) {
                        }
                    } catch (e) {
                        remaining.push(task);
                    }
                }

                await LocalStorageService.clearPendingDeletes();
                if (remaining.length > 0) {
                    for (const task of remaining) {
                        await LocalStorageService.queuePendingDelete(task.ids, task.user);
                    }
                } else {
                    logger.log('[SYNC] All pending deletions processed.');
                }
            }
        } catch (e) {
            logger.error('Failed to process pending deletes', e);
        }
    };

    const fetchEmails = useCallback(async (overrideProfile?: UserProfile | null) => {
        logger.log('[useEmails] fetchEmails started', { profile: !!overrideProfile, currentUser, authToken: !!authToken });
        if (!settingsLoaded) {
            logger.log('[useEmails] fetchEmails deferred: settings not loaded');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const effectiveProfile = overrideProfile !== undefined ? overrideProfile : userProfile;

            // 1. Process Pending Deletes (Ensure consistency before fetch)
            setSyncing(true);
            await processPendingDeletes();
            setSyncing(false);

            // 2. Load and Filter Local History
            const rawLocalEmails = await LocalStorageService.getEmails();
            let activeEmail = effectiveProfile?.email || currentUser;

            // FALLBACK: If no identity but we have local emails with ownerEmail, use that
            if (!activeEmail && rawLocalEmails.length > 0) {
                const ownerEmails = rawLocalEmails
                    .map(e => e.ownerEmail)
                    .filter((email): email is string => !!email);
                if (ownerEmails.length > 0) {
                    // Use the most common ownerEmail as the identity
                    const counts = ownerEmails.reduce((acc, email) => {
                        acc[email] = (acc[email] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    activeEmail = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                    logger.log(`[useEmails] Fallback: Inferred identity from ownerEmail: ${activeEmail}`);
                }
            }

            logger.log(`[useEmails] Step 2: rawLocal=${rawLocalEmails.length}, active=${activeEmail}, profile=${effectiveProfile?.email}`);
            if (rawLocalEmails.length > 0) {
                logger.log('[useEmails] Sample local email:', {
                    id: rawLocalEmails[0].id,
                    user: rawLocalEmails[0].user,
                    ownerEmail: rawLocalEmails[0].ownerEmail
                });
            }

            // IDENTITY FILTERING:
            // Cloud Mode: No filtering, server (ownerId) is the source of truth.
            // Local/Anonymous Mode: Show ALL local emails, regardless of sender.
            // User requirement: "All of them will be in one list in the extension" (Local Mode).
            const localEmails = rawLocalEmails;

            const localIds = localEmails.map(e => e.id);
            logger.log(`[useEmails] Step 3: filteredLocal=${localEmails.length}, localIds=${localIds.length}`);



            // 3. Build Query
            const params = new URLSearchParams();
            params.append('limit', '1000');
            params.append('t', String(Date.now()));

            if (effectiveProfile) {
                // Cloud mode: fetch by owner (most secure/accurate)
                params.append('ownerId', effectiveProfile.id);
            } else if (localIds.length > 0) {
                // Anonymous Session: fetch strictly by IDs currently stored on this device.
                // This prevents leaking the email address in the query string (privacy first).
                params.append('ids', localIds.join(','));
            }

            // 3. Execution: Cloud Fetch and Anonymous Sync
            let rawResults: any[] = [];
            const fetchPromises: Promise<any[]>[] = [];

            // Promise 1: Cloud Fetch (by ownerId)
            if (effectiveProfile) {
                // params already contains ownerId and limit
                fetchPromises.push(DashboardService.fetchEmails(params, authToken));
            }

            // Promise 2: Status Sync (by IDs) - ALWAYS fetch for local IDs to ensure stats are accurate
            // even for items not yet claimed by this account or lazy-registered.
            if (localIds.length > 0) {
                const CHUNK_SIZE = 1000;
                for (let i = 0; i < localIds.length; i += CHUNK_SIZE) {
                    const chunkIds = localIds.slice(i, i + CHUNK_SIZE);
                    fetchPromises.push(DashboardService.syncStatus(chunkIds));
                }
            }

            if (fetchPromises.length > 0) {
                try {
                    const results = await Promise.all(fetchPromises);
                    rawResults = results.flat();
                } catch (err) {
                    logger.error('[useEmails] Data fetch failed:', err);
                    // Continue with what we have (partial results or local only)
                }
            }

            // DE-DUPLICATE RESULTS (Priority: cloud response often has more data than sync response)
            // But actually syncStatus returns limited metadata. 
            // We want the most complete object for each ID.
            const uniqueResultsMap = new Map<string, any>();
            rawResults.forEach(item => {
                const existing = uniqueResultsMap.get(item.id);
                if (!existing || (item.subject && !existing.subject)) {
                    uniqueResultsMap.set(item.id, item);
                }
            });
            const serverEmails = Array.from(uniqueResultsMap.values());

            if (!effectiveProfile && localIds.length === 0) {
                // No cloud profile and no local IDs -> nothing to fetch anonymously.
                setEmails([]);
                setStats({ tracked: 0, opened: 0, rate: 0 });
                setLoading(false);
                return;
            }

            // 4. Merge Strategy
            const emailMap = new Map<string, TrackedEmail>();
            const localEmailMap = new Map(localEmails.map(e => [e.id, e]));
            const emailsToSave: TrackedEmail[] = [];

            // Priority 1: Server Data
            serverEmails.forEach((e: any) => {
                const localEmail = localEmailMap.get(e.id);
                const serverSubject = e.subject || '';
                const serverRecipient = e.recipient || '';

                const isPlaceholderSubject = !serverSubject || serverSubject.includes('Subject Unavailable');
                const isPlaceholderRecipient = !serverRecipient || serverRecipient === 'Unknown';

                const serverCount = e._count?.opens ?? e.opens?.length ?? e.openCount ?? 0;
                const localCount = localEmail?.openCount ?? 0;
                const calculatedCount = Math.max(serverCount, localCount);

                const enriched = {
                    ...localEmail, // Start with local metadata (identity, subject, recipient)
                    ...e,          // Overwrite with server status (id, ownerId, opens)
                    subject: isPlaceholderSubject && localEmail?.subject ? localEmail.subject : serverSubject,
                    recipient: isPlaceholderRecipient && localEmail?.recipient ? localEmail.recipient : serverRecipient,
                    cc: e.cc || localEmail?.cc,
                    bcc: e.bcc || localEmail?.bcc,
                    body: e.body || localEmail?.body || '',
                    user: localEmail?.user || e.user || activeEmail || '', // Use local identity as priority
                    openCount: calculatedCount,
                    opens: e.opens || []
                };
                emailMap.set(e.id, enriched);

                emailsToSave.push({
                    id: enriched.id,
                    subject: enriched.subject,
                    recipient: enriched.recipient,
                    cc: enriched.cc,
                    bcc: enriched.bcc,
                    body: enriched.body,
                    user: enriched.user,
                    ownerEmail: userProfile?.email || localEmail?.ownerEmail,
                    createdAt: enriched.createdAt,
                    opens: enriched.opens,
                    openCount: enriched.openCount
                } as TrackedEmail);
            });

            // Priority 2: Local Data (Items NOT found on server during this fetch)
            localEmails.forEach(local => {
                const existing = emailMap.get(local.id);
                if (existing) {
                    // Update existing with better local metadata if needed
                    emailMap.set(local.id, {
                        ...existing,
                        subject: (existing.subject && !existing.subject.includes('Subject Unavailable'))
                            ? existing.subject
                            : local.subject,
                        recipient: existing.recipient || local.recipient,
                        cc: existing.cc || local.cc,
                        bcc: existing.bcc || local.bcc,
                        body: existing.body || local.body,
                        user: existing.user || local.user,
                    });
                } else {
                    // Item exists locally but NOT on server (or server fetch missed it)
                    emailMap.set(local.id, {
                        ...local,
                        opens: [],
                        openCount: local.openCount || 0,
                        createdAt: local.createdAt || new Date().toISOString()
                    } as unknown as TrackedEmail);
                }
            });

            const mergedList = Array.from(emailMap.values())
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setEmails(mergedList);

            // Calculate Stats (Initial calculation, UI might refine it based on filters)
            const tracked = mergedList.length;
            const opened = mergedList.filter(e => e.openCount > 0).length;
            const rate = tracked > 0 ? Math.round((opened / tracked) * 100) : 0;
            setStats({ tracked, opened, rate });

        } catch (e: any) {
            logger.error('Failed to fetch emails:', e);
            setError(e.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [userProfile, currentUser, authToken, settingsLoaded]);

    const deleteSingleEmail = useCallback(async (id: string): Promise<{ success: boolean, message?: string, type?: 'success' | 'warning' }> => {
        // Optimistic Update
        const previousEmails = [...emails];
        setEmails(prev => prev.filter(e => e.id !== id));

        try {
            // 1. Local Delete
            await LocalStorageService.deleteEmail(id);

            // 2. Remote Delete
            const params = new URLSearchParams();
            params.append('ids', id);
            if (userProfile) {
                params.append('ownerId', userProfile.id);
            }

            try {
                await DashboardService.deleteEmails(params, authToken);
            } catch (apiErr: any) {
                // If 403 Forbidden: Ownership issues (anonymous trying to delete owned data)
                const status = apiErr.status || (apiErr.message?.includes('403') ? 403 : null);

                // EXTRA SAFETY: If we know it's owned locally but server said 403, it's definitely an ownership issue.
                const isForbidden = status === 403;

                if (isForbidden) {
                    logger.log('[useEmails] Delete forbidden (owned by account)');
                    return {
                        success: true,
                        message: 'Email removed from this device. Please sign in to delete it from the cloud.',
                        type: 'warning'
                    };
                }

                logger.error('[useEmails] Remote delete failed:', apiErr);
                // Queue for later retry (transient failures)
                await LocalStorageService.queuePendingDelete([id], userProfile?.email);

                return {
                    success: true,
                    message: 'Email removed from this device. Cloud deletion will be retried later.',
                    type: 'warning'
                };
            }

            return { success: true };
        } catch (e: any) {
            logger.error('[useEmails] Failed to delete email:', e);
            // Rollback optimistic update
            setEmails(previousEmails);
            return {
                success: false,
                message: 'Failed to delete email: ' + e.message
            };
        }
    }, [emails, userProfile, authToken]);

    const deleteEmails = useCallback(async (
        filterSender: string = 'all'
    ): Promise<{ success: boolean, message: string, type?: 'success' | 'warning' }> => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            if (userProfile) {
                // Cloud Mode: Delete All or Specific
                const cloudParams = new URLSearchParams();
                cloudParams.append('ownerId', userProfile.id);
                if (filterSender !== 'all') {
                    cloudParams.append('user', filterSender);
                }

                // Persistent Local Deletion
                if (filterSender === 'all') {
                    await LocalStorageService.deleteAll();
                } else {
                    await LocalStorageService.deleteBySender(filterSender);
                }

                // Optimistic UI update: Filter based on sender
                setEmails(prev => filterSender === 'all'
                    ? []
                    : prev.filter(e => e.user !== filterSender)
                );

                await DashboardService.deleteEmails(cloudParams, authToken);
            } else {
                // Incognito Mode: Attempt anonymous remote deletion for unowned data
                const targetSender: string | null = filterSender !== 'all' ? filterSender : null;

                // Collect IDs to satisfy backend validation and prove ownership
                const localEmails = await LocalStorageService.getEmails();
                const targetEmails = targetSender
                    ? localEmails.filter(e => e.user === targetSender)
                    : localEmails;

                // SPLIT: Only unowned can be deleted anonymously
                // NOTE: Use ownerEmail OR isOwned to capture legacy data correctly
                const unownedIds = targetEmails.filter(e => !e.isOwned && !e.ownerEmail).map(e => e.id);
                const ownedCount = targetEmails.filter(e => !!e.isOwned || !!e.ownerEmail).length;

                let remoteFailedWithForbidden = false;

                // 2. Perform Local Deletion (Immediate UI feedback)
                if (targetSender) {
                    await LocalStorageService.deleteBySender(targetSender);
                    setEmails(prev => prev.filter(e => e.user !== targetSender));
                } else {
                    await LocalStorageService.deleteAll();
                    setEmails([]);
                }

                // 3. Perform Remote Deletion (For Unowned Items Only)
                if (unownedIds.length > 0) {
                    params.append('ids', unownedIds.join(','));
                    try {
                        // Call server anonymously
                        await DashboardService.deleteEmails(params, null);
                    } catch (apiErr: any) {
                        const isForbidden = apiErr.status === 403 || apiErr.message?.includes('403');
                        if (isForbidden) {
                            remoteFailedWithForbidden = true;
                        } else {
                            logger.warn('[useEmails] anonymous bulk delete failed on server (transient)', apiErr);
                        }
                    }
                }

                // 4. Return correct UI feedback
                if (ownedCount > 0 || remoteFailedWithForbidden) {
                    // Refresh from server to get accurate state
                    fetchEmails();

                    return {
                        success: true,
                        message: 'Local history cleared. Some data on the server belongs to an account and requires sign-in to delete.',
                        type: 'warning'
                    };
                }

                // Manual refresh not needed because we updated state optimistically above
                // but let's do a quiet re-fetch for safety.
                fetchEmails();

                return {
                    success: true,
                    message: targetSender
                        ? `History for "${targetSender}" has been cleared.`
                        : 'Tracking history has been cleared from this device and the cloud.',
                    type: 'success'
                };
            }

            // Refresh (Cloud mode path)
            fetchEmails();

            return {
                success: true,
                message: filterSender === 'all'
                    ? 'Tracking history has been cleared successfully.'
                    : `Tracking history for "${filterSender}" has been cleared.`,
                type: 'success'
            };

        } catch (e: any) {
            logger.error('Delete failed', e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [userProfile, fetchEmails]);

    // Fetch when userProfile or currentUser changes (NOT on mount to avoid race)
    // This ensures we use ownerId in cloud mode after login completes
    // Fetch data whenever auth context changes OR after settings are loaded
    useEffect(() => {
        if (settingsLoaded) {
            fetchEmails();
        }
    }, [userProfile, currentUser, settingsLoaded]);

    return {
        emails,
        stats,
        loading: loading || syncing,
        error,
        fetchEmails,
        deleteEmails,
        deleteSingleEmail,
        setEmails // Exposed for optimistic updates
    };
};
