import { useCallback } from 'react';
import { LocalStorageService } from '../../services/LocalStorageService';
import { DashboardService } from '../../services/DashboardService';
import { logger } from '../../utils/logger';
import { useTranslation } from '../useTranslation';
import { CONSTANTS } from '../../config/constants';
import type { TrackedEmail } from '../../types';
import type { UserProfile } from '../../services/AuthService';

export const useEmailDelete = (
    emails: TrackedEmail[],
    setEmails: React.Dispatch<React.SetStateAction<TrackedEmail[]>>,
    userProfile: UserProfile | null,
    authToken: string | null,
    fetchEmails: () => Promise<void>,
    setLoading: (loading: boolean) => void
) => {
    const { t } = useTranslation();

    const deleteSingleEmail = useCallback(async (id: string): Promise<{ success: boolean, message?: string, type?: 'success' | 'warning' }> => {
        const previousEmails = [...emails];
        setEmails(prev => prev.filter(e => e.id !== id));

        try {
            await LocalStorageService.deleteEmail(id);

            const params = new URLSearchParams();
            params.append('ids', id);
            if (userProfile) {
                params.append('ownerId', userProfile.id);
            }

            try {
                await DashboardService.deleteEmails(params, authToken);
            } catch (err: unknown) {
                const apiErr = err as Error & { status?: number };
                const status = apiErr.status || (apiErr.message?.includes(String(CONSTANTS.STATUS.FORBIDDEN)) ? CONSTANTS.STATUS.FORBIDDEN : null);

                if (status === CONSTANTS.STATUS.FORBIDDEN) {
                    return {
                        success: true,
                        message: t('delete_warning_forbidden'),
                        type: 'warning'
                    };
                }

                await LocalStorageService.queuePendingDelete([id], userProfile?.email);
                return {
                    success: true,
                    message: t('delete_warning_retry'),
                    type: 'warning'
                };
            }

            return { success: true };
        } catch (err: unknown) {
            const e = err as Error;
            logger.error('[useEmailDelete] Failed to delete email:', e);
            setEmails(previousEmails);
            return {
                success: false,
                message: 'Failed to delete email: ' + e.message
            };
        }
    }, [emails, userProfile, authToken, t, setEmails]);

    const deleteEmails = useCallback(async (
        filterSender: string = CONSTANTS.UI.FILTER_ALL
    ): Promise<{ success: boolean, message: string, type?: 'success' | 'warning' }> => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            if (userProfile) {
                const cloudParams = new URLSearchParams();
                cloudParams.append('ownerId', userProfile.id);
                if (filterSender !== CONSTANTS.UI.FILTER_ALL) {
                    cloudParams.append('user', filterSender);
                }

                if (filterSender === CONSTANTS.UI.FILTER_ALL) {
                    await LocalStorageService.deleteAll();
                } else {
                    await LocalStorageService.deleteBySender(filterSender);
                }

                setEmails(prev => filterSender === CONSTANTS.UI.FILTER_ALL
                    ? []
                    : prev.filter(e => e.user !== filterSender)
                );

                await DashboardService.deleteEmails(cloudParams, authToken);
            } else {
                const targetSender: string | null = filterSender !== CONSTANTS.UI.FILTER_ALL ? filterSender : null;
                const localEmails = await LocalStorageService.getEmails();
                const targetEmails = targetSender
                    ? localEmails.filter(e => e.user === targetSender)
                    : localEmails;

                const unownedIds = targetEmails.filter(e => !e.isOwned && !e.ownerEmail).map(e => e.id);
                const ownedCount = targetEmails.filter(e => !!e.isOwned || !!e.ownerEmail).length;

                let remoteFailedWithForbidden = false;

                if (targetSender) {
                    await LocalStorageService.deleteBySender(targetSender);
                    setEmails(prev => prev.filter(e => e.user !== targetSender));
                } else {
                    await LocalStorageService.deleteAll();
                    setEmails([]);
                }

                if (unownedIds.length > 0) {
                    params.append('ids', unownedIds.join(','));
                    try {
                        await DashboardService.deleteEmails(params, null);
                    } catch (err: unknown) {
                        const apiErr = err as Error & { status?: number };
                        if (apiErr.status === CONSTANTS.STATUS.FORBIDDEN || apiErr.message?.includes(String(CONSTANTS.STATUS.FORBIDDEN))) {
                            remoteFailedWithForbidden = true;
                        }
                    }
                }

                if (ownedCount > 0 || remoteFailedWithForbidden) {
                    await fetchEmails();
                    return {
                        success: true,
                        message: t('delete_warning_owned_data'),
                        type: 'warning'
                    };
                }
            }

            await fetchEmails();

            return {
                success: true,
                message: filterSender === CONSTANTS.UI.FILTER_ALL
                    ? t('delete_success_generic')
                    : t('delete_success_sender_generic', { sender: filterSender }),
                type: 'success'
              };
    
            } catch (err: unknown) {
                logger.error('[useEmailDelete] Bulk delete failed', err);
                throw err;
            } finally {
                setLoading(false);
            }
        }, [userProfile, authToken, fetchEmails, t, setEmails, setLoading]);
    
        return {
            deleteEmails,
            deleteSingleEmail
        };
    };

