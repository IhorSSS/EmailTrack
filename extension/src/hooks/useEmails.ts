import { useState, useCallback, useEffect } from 'react';
import { API_CONFIG } from '../config/api';
import { LocalStorageService } from '../services/LocalStorageService';
import { DashboardService } from '../services/DashboardService';
import type { TrackedEmail } from '../types';
import type { UserProfile } from '../services/AuthService';

export interface EmailStats {
    tracked: number;
    opened: number;
    rate: number;
}

export const useEmails = (userProfile: UserProfile | null, currentUser: string | null, authToken: string | null) => {
    const [emails, setEmails] = useState<TrackedEmail[]>([]);
    const [stats, setStats] = useState<EmailStats>({ tracked: 0, opened: 0, rate: 0 });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const processPendingDeletes = async () => {
        try {
            const pending = await LocalStorageService.getPendingDeletes();
            if (pending.length > 0) {
                console.log(`[SYNC] Processing ${pending.length} pending delete requests...`);
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
                            console.warn('[SYNC] Retry delete failed, keeping in queue', res.status);
                            remaining.push(task);
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
                    console.log('[SYNC] All pending deletions processed.');
                }
            }
        } catch (e) {
            console.error('Failed to process pending deletes', e);
        }
    };

    const fetchEmails = useCallback(async (overrideProfile?: UserProfile | null) => {
        setLoading(true);
        setError(null);
        try {
            const effectiveProfile = overrideProfile !== undefined ? overrideProfile : userProfile;

            // 1. Process Pending Deletes (Ensure consistency before fetch)
            setSyncing(true);
            await processPendingDeletes();
            setSyncing(false);

            // 2. Load Local History
            const localEmails = await LocalStorageService.getEmails();
            const localIds = localEmails.map(e => e.id);

            // 3. Build Query
            const params = new URLSearchParams();
            params.append('limit', '1000');
            params.append('t', String(Date.now()));

            if (effectiveProfile) {
                params.append('ownerId', effectiveProfile.id);
            } else if (currentUser) {
                params.append('user', currentUser);
            }

            // Hybrid: Ask for stats for local IDs ONLY if we receive no specific profile/owner
            // If we are logged in (Cloud Mode), we want the full server list (Pagination), invalidating local cache restriction.
            if (localIds.length > 0 && !effectiveProfile) {
                params.append('ids', localIds.join(','));
            }

            if (!effectiveProfile && !currentUser && localIds.length === 0) {
                setEmails([]);
                setStats({ tracked: 0, opened: 0, rate: 0 });
                setLoading(false);
                return;
            }

            const serverEmails = await DashboardService.fetchEmails(params, authToken);

            // 4. Merge Strategy
            const emailMap = new Map<string, TrackedEmail>();
            const emailsToSave: TrackedEmail[] = [];

            // Priority 1: Server Data
            serverEmails.forEach((e: any) => {
                const enriched = {
                    ...e,
                    openCount: e._count?.opens ?? e.openCount ?? 0,
                    opens: e.opens || []
                };
                emailMap.set(e.id, enriched);

                // Hydration: Prepare for batch save
                emailsToSave.push({
                    id: enriched.id,
                    subject: (enriched.subject && !enriched.subject.includes('Subject Unavailable')) ? enriched.subject : '',
                    recipient: enriched.recipient || '',
                    body: enriched.body || '',
                    user: enriched.user || '',
                    createdAt: enriched.createdAt,
                    // Hydrate full object to conform to TrackedEmail if LocalStorage supports it
                    opens: e.opens || [],
                    openCount: e.openCount || 0
                } as TrackedEmail);
            });

            // Batch save to prevent async race conditions
            if (emailsToSave.length > 0) {
                await LocalStorageService.saveEmails(emailsToSave);
            }

            // Priority 2: Local Data
            localEmails.forEach(local => {
                const existing = emailMap.get(local.id);
                if (existing) {
                    emailMap.set(local.id, {
                        ...existing,
                        // Fix: Ignore placeholder subject from server lazy-registration
                        subject: (existing.subject && !existing.subject.includes('Subject Unavailable'))
                            ? existing.subject
                            : local.subject,
                        recipient: existing.recipient || local.recipient,
                        body: existing.body || local.body,
                        user: existing.user || local.user,
                    });
                } else {
                    // Only keep local if we are NOT in strict Cloud Mode or if we prefer merging?
                    // If we are in Cloud Mode, and local item is NOT in server list (e.g. page 1),
                    // we show it anyway?
                    // Better to show what we have.
                    emailMap.set(local.id, {
                        ...local,
                        opens: [],
                        openCount: 0,
                        createdAt: local.createdAt || new Date().toISOString()
                    } as TrackedEmail);
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
            console.error('Failed to fetch emails:', e);
            setError(e.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [userProfile, currentUser, authToken]);

    const deleteEmails = useCallback(async (
        filterSender: string = 'all',
        idsToDelete: string[] = []
    ): Promise<{ success: boolean, message: string }> => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            let isServerSuccess = true;

            if (userProfile) {
                // Cloud Mode: Delete All or Specific
                params.append('ownerId', userProfile.id);
                if (filterSender !== 'all') params.append('user', filterSender);
                // Maintain legacy behavior for safety
                if (userProfile.email) params.append('user', userProfile.email);

                await DashboardService.deleteEmails(params, authToken);
                await LocalStorageService.deleteAll();
            } else {
                // Incognito Mode
                // 1. Prepare IDs
                let targetIds = idsToDelete;
                let targetSender: string | null = filterSender !== 'all' ? filterSender : null;

                if (targetIds.length === 0) {
                    if (targetSender) {
                        const local = await LocalStorageService.getEmails();
                        targetIds = local.filter(e => e.user === targetSender).map(e => e.id);
                    } else {
                        const local = await LocalStorageService.getEmails();
                        targetIds = local.map(e => e.id);
                    }
                }

                // 2. Server Delete
                if (targetIds.length > 0) {
                    params.append('ids', targetIds.join(','));
                    if (targetSender) params.append('user', targetSender);

                    try {
                        await DashboardService.deleteEmails(params, authToken);
                    } catch (e) {
                        isServerSuccess = false;
                        await LocalStorageService.queuePendingDelete(targetIds, targetSender || undefined);
                    }
                }

                // 3. Local Delete
                if (targetSender) {
                    await LocalStorageService.deleteBySender(targetSender);
                } else {
                    await LocalStorageService.deleteAll();
                }
            }

            // Refresh
            setEmails([]);
            setStats({ tracked: 0, opened: 0, rate: 0 });
            fetchEmails();

            return {
                success: isServerSuccess,
                message: isServerSuccess
                    ? 'Tracking history has been cleared successfully.'
                    : 'History cleared from device. Server was unreachable, so deletion has been QUEUED for automatic retry.'
            };

        } catch (e: any) {
            console.error('Delete failed', e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [userProfile, fetchEmails]);

    // Initial load
    useEffect(() => {
        // Trigger fetch when profile or user changes
        // But we want to avoid double-fetch if App handles it. 
        // Let's provide the method and let App (or the component using it) trigger it on mount/change.
        // Actually, typical useEmails hook should auto-fetch.
        fetchEmails();
    }, [fetchEmails]);

    return {
        emails,
        stats,
        loading: loading || syncing,
        error,
        fetchEmails,
        deleteEmails,
        setEmails // Exposed for optimistic updates
    };
};
