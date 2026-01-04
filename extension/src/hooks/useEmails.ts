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
                            if (res.status === 403 || res.status === 401) {
                                console.warn('[SYNC] Delete forbidden (403/401), discarding from queue:', task);
                                // Do not retry - we are not authorized
                            } else {
                                console.warn('[SYNC] Retry delete failed, keeping in queue', res.status);
                                remaining.push(task);
                            }
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
        console.log('[useEmails] fetchEmails started', { profile: !!overrideProfile, currentUser, authToken: !!authToken });
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
            const activeEmail = effectiveProfile?.email || currentUser;

            // Only keep local emails that belong to the current active identity
            const localEmails = rawLocalEmails.filter(e => e.user === activeEmail);
            const localIds = localEmails.map(e => e.id);

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

            if (!effectiveProfile && localIds.length === 0) {
                // No cloud profile and no local IDs -> nothing to fetch anonymously.
                setEmails([]);
                setStats({ tracked: 0, opened: 0, rate: 0 });
                setLoading(false);
                return;
            }

            const serverEmails = await DashboardService.fetchEmails(params, authToken);

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
                    ...e,
                    subject: isPlaceholderSubject && localEmail?.subject ? localEmail.subject : serverSubject,
                    recipient: isPlaceholderRecipient && localEmail?.recipient ? localEmail.recipient : serverRecipient,
                    body: e.body || localEmail?.body || '',
                    openCount: calculatedCount,
                    opens: e.opens || []
                };
                emailMap.set(e.id, enriched);

                emailsToSave.push({
                    id: enriched.id,
                    subject: enriched.subject,
                    recipient: enriched.recipient,
                    body: enriched.body,
                    user: enriched.user || localEmail?.user || activeEmail || '',
                    createdAt: enriched.createdAt,
                    opens: e.opens || [],
                    openCount: enriched.openCount
                } as TrackedEmail);
            });

            // Batch save
            if (emailsToSave.length > 0) {
                await LocalStorageService.saveEmails(emailsToSave);
            }

            // Priority 2: Local Data (Already filtered by identity above)
            localEmails.forEach(local => {
                const existing = emailMap.get(local.id);
                if (existing) {
                    emailMap.set(local.id, {
                        ...existing,
                        subject: (existing.subject && !existing.subject.includes('Subject Unavailable'))
                            ? existing.subject
                            : local.subject,
                        recipient: existing.recipient || local.recipient,
                        body: existing.body || local.body,
                        user: existing.user || local.user,
                    });
                } else {
                    // Only keep local if it belongs to current active user (checked in Step 2)
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
        filterSender: string = 'all'
    ): Promise<{ success: boolean, message: string }> => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            if (userProfile) {
                // Cloud Mode: Delete All or Specific
                params.append('ownerId', userProfile.id);
                if (filterSender !== 'all') params.append('user', filterSender);
                // Maintain legacy behavior for safety
                if (userProfile.email) params.append('user', userProfile.email);

                await DashboardService.deleteEmails(params, authToken);
                await LocalStorageService.deleteAll();
            } else {
                // Incognito Mode: Local-only deletion. Server data requires authentication.
                const targetSender: string | null = filterSender !== 'all' ? filterSender : null;

                // Local Delete only
                if (targetSender) {
                    await LocalStorageService.deleteBySender(targetSender);
                } else {
                    await LocalStorageService.deleteAll();
                }

                // No server call in Incognito - this is by design for security
                // Refresh
                setEmails([]);
                setStats({ tracked: 0, opened: 0, rate: 0 });
                fetchEmails();

                return {
                    success: true,
                    message: targetSender
                        ? `Local history for "${targetSender}" cleared. Sign in to manage server data.`
                        : 'Local history cleared from this device. Sign in to manage server data.'
                };
            }

            // Refresh (Cloud mode path)
            setEmails([]);
            setStats({ tracked: 0, opened: 0, rate: 0 });
            fetchEmails();

            return {
                success: true,
                message: 'Tracking history has been cleared successfully.'
            };

        } catch (e: any) {
            console.error('Delete failed', e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [userProfile, fetchEmails]);

    // Fetch when userProfile or currentUser changes (NOT on mount to avoid race)
    // This ensures we use ownerId in cloud mode after login completes
    // Fetch data whenever auth context changes
    useEffect(() => {
        fetchEmails();
    }, [userProfile, currentUser]);

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
