import { useState, useCallback } from 'react';
import { API_CONFIG } from '../../config/api';
import { CONSTANTS } from '../../config/constants';
import { LocalStorageService } from '../../services/LocalStorageService';
import { DashboardService } from '../../services/DashboardService';
import { logger } from '../../utils/logger';
import { useTranslation } from '../useTranslation';
import type { TrackedEmail, EmailStats, LocalEmailMetadata, OpenEvent } from '../../types';


import type { UserProfile } from '../../services/AuthService';

export const useEmailFetch = (
    userProfile: UserProfile | null,
    currentUser: string | null,
    authToken: string | null,
    settingsLoaded: boolean
) => {
    const { t } = useTranslation();
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
                const urlBase = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}`;

                const remaining: { ids: string[], user?: string }[] = [];

                for (const task of pending) {
                    try {
                        const params = new URLSearchParams();
                        params.append('ids', task.ids.join(','));
                        if (task.user) params.append('user', task.user);

                        const res = await fetch(`${urlBase}?${params.toString()}`, { method: 'DELETE' });
                        if (!res.ok) {
                            remaining.push(task);
                        }
                    } catch {
                        remaining.push(task);
                    }
                }

                await LocalStorageService.clearPendingDeletes();
                if (remaining.length > 0) {
                    for (const task of remaining) {
                        await LocalStorageService.queuePendingDelete(task.ids, task.user);
                    }
                }
            }
        } catch (e) {
            logger.error('Failed to process pending deletes', e);
        }
    };

    const fetchEmails = useCallback(async (overrideProfile?: UserProfile | null) => {
        if (!settingsLoaded) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const effectiveProfile = overrideProfile !== undefined ? overrideProfile : userProfile;

            // 1. Process Pending Deletes
            setSyncing(true);
            await processPendingDeletes();
            setSyncing(false);

            // 2. Load Local History
            const rawLocalMetadata: LocalEmailMetadata[] = await LocalStorageService.getEmails();
            const rawLocalEmails: TrackedEmail[] = rawLocalMetadata.map(m => ({
                ...m,
                opens: [],
                openCount: m.openCount || 0
            }));
            let activeEmail = effectiveProfile?.email || currentUser;


            // Fallback identity inference
            if (!activeEmail && rawLocalEmails.length > 0) {
                const ownerEmails = rawLocalEmails
                    .map(e => e.ownerEmail)
                    .filter((email): email is string => !!email);
                if (ownerEmails.length > 0) {
                    const counts = ownerEmails.reduce((acc: Record<string, number>, email: string) => {
                        acc[email] = (acc[email] || 0) + 1;
                        return acc;
                    }, {});
                    activeEmail = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                }
            }

            const localEmails = rawLocalEmails;
            const localIds = localEmails.map(e => e.id);

            // 3. Build Query
            const params = new URLSearchParams();
            params.append('limit', String(CONSTANTS.UI.FETCH_LIMIT));
            params.append('t', String(Date.now()));

            if (effectiveProfile) {
                params.append('ownerId', effectiveProfile.id);
            } else if (localIds.length > 0) {
                params.append('ids', localIds.join(','));
            }

            // 4. Execution
            interface ServerEmail extends Partial<Omit<TrackedEmail, 'opens'>> {
                _count?: { opens: number };
                opens?: OpenEvent[];
                openCount?: number;
            }

            let rawResults: ServerEmail[] = [];
            const fetchPromises: Promise<ServerEmail[]>[] = [];

            if (effectiveProfile) {
                fetchPromises.push(DashboardService.fetchEmails(params, authToken) as Promise<ServerEmail[]>);
            }

            if (localIds.length > 0) {
                const CHUNK_SIZE = CONSTANTS.CHUNKS.FETCH_SIZE;
                for (let i = 0; i < localIds.length; i += CHUNK_SIZE) {
                    const chunkIds = localIds.slice(i, i + CHUNK_SIZE);
                    fetchPromises.push(DashboardService.syncStatus(chunkIds) as Promise<ServerEmail[]>);
                }
            }

            if (fetchPromises.length > 0) {
                try {
                    const results = await Promise.all(fetchPromises);
                    rawResults = results.flat();
                } catch (err) {
                    logger.error('[useEmailFetch] Data fetch failed:', err);
                }
            }

            // De-duplicate
            const uniqueResultsMap = new Map<string, ServerEmail>();
            rawResults.forEach(item => {
                if (!item.id) return;
                const existing = uniqueResultsMap.get(item.id);
                if (!existing || (item.subject && !existing.subject)) {
                    uniqueResultsMap.set(item.id, item);
                }
            });
            const serverEmails = Array.from(uniqueResultsMap.values());

            if (!effectiveProfile && localIds.length === 0) {
                setEmails([]);
                setStats({ tracked: 0, opened: 0, rate: 0 });
                setLoading(false);
                return;
            }

            // 5. Merge
            const emailMap = new Map<string, TrackedEmail>();
            const localEmailMap = new Map(localEmails.map(e => [e.id, e]));
            const emailsToSave: TrackedEmail[] = [];

            serverEmails.forEach((e) => {
                if (!e.id) return;
                const localEmail = localEmailMap.get(e.id);
                const serverSubject = e.subject || '';
                const serverRecipient = e.recipient || '';

                const isPlaceholderSubject = !serverSubject || serverSubject.includes(CONSTANTS.UI.SUBJECT_UNAVAILABLE);
                const isPlaceholderRecipient = !serverRecipient || serverRecipient === CONSTANTS.UI.UNKNOWN_SENDER;

                // Handle nested count object from Prisma or direct number
                const serverCount = e._count?.opens ?? e.opens?.length ?? e.openCount ?? 0;

                const localCount = localEmail?.openCount ?? 0;
                const calculatedCount = Math.max(serverCount, localCount);

                const enriched: TrackedEmail = {
                    id: e.id,
                    subject: isPlaceholderSubject && localEmail?.subject ? localEmail.subject : serverSubject,
                    recipient: isPlaceholderRecipient && localEmail?.recipient ? localEmail.recipient : serverRecipient,
                    cc: e.cc || localEmail?.cc,
                    bcc: e.bcc || localEmail?.bcc,
                    body: e.body || localEmail?.body || '',
                    user: localEmail?.user || e.user || activeEmail || '',
                    openCount: calculatedCount,
                    opens: e.opens || [],
                    createdAt: e.createdAt || localEmail?.createdAt || new Date().toISOString(),
                    ownerEmail: userProfile?.email || localEmail?.ownerEmail
                };
                emailMap.set(e.id, enriched);
                emailsToSave.push(enriched);
            });



            if (emailsToSave.length > 0) {
                await LocalStorageService.saveEmails(emailsToSave);
            }

            localEmails.forEach(local => {
                const existing = emailMap.get(local.id);
                if (!existing) {
                    emailMap.set(local.id, {
                        ...local,
                        opens: [],
                        openCount: local.openCount || 0,
                    });
                }
            });



            const mergedList = Array.from(emailMap.values())
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setEmails(mergedList);

            const tracked = mergedList.length;
            const opened = mergedList.filter(e => e.openCount > 0).length;
            const rate = tracked > 0 ? Math.round((opened / tracked) * 100) : 0;
            setStats({ tracked, opened, rate });

        } catch (e: unknown) {
            const err = e as Error;
            logger.error('Failed to fetch emails:', err);
            setError(err.message || t('error_load_data'));
        } finally {
            setLoading(false);
        }
    }, [userProfile, currentUser, authToken, settingsLoaded, t]);

    return {
        emails,
        stats,
        loading: loading || syncing,
        error,
        fetchEmails,
        setEmails
    };
};
