import { useCallback } from 'react';
import { AuthService, type UserProfile } from '../services/AuthService';
import { LocalStorageService } from '../services/LocalStorageService';
import { CONSTANTS } from '../config/constants';
import { logger } from '../utils/logger';
import { useTranslation } from './useTranslation';

/**
 * useAuthSync - Headless Hook for handling post-login synchronization and conflict resolution.
 * Decomposes complex sync logic from the main useAuth hook.
 */
export const useAuthSync = () => {
    const { t } = useTranslation();

    const handlePostLoginSync = useCallback(async (profile: UserProfile, token: string) => {
        logger.log('[useAuthSync] Starting post-login sync for:', profile.email);

        // 1. Client-Side Email Ownership Integrity
        const localEmails = await LocalStorageService.getEmails();
        
        // 2. Server Conflict Check (Identity Proofing)
        const localIds = localEmails.map(e => e.id);
        if (localIds.length > 0) {
            const hasConflict = await AuthService.checkOwnershipConflict(localIds, profile.id, token);
            if (hasConflict) {
                logger.error('[useAuthSync] Server-side account conflict detected');
                throw new Error(t('error_account_conflict'));
            }
        }

        // 3. System Registration / Sync
        await AuthService.syncUser(profile.email, profile.id, token);

        // 4. History Upload (Cold Migration)
        // We fetch again to catch emails tracked during the auth popup window
        const freshLocalEmails = await LocalStorageService.getEmails();
        if (freshLocalEmails.length > 0) {
            try {
                const count = await AuthService.uploadHistory(
                    freshLocalEmails.map(e => ({
                        id: e.id,
                        subject: e.subject,
                        recipient: e.recipient,
                        cc: e.cc,
                        bcc: e.bcc,
                        body: e.body,
                        sender: e.user
                    })),
                    profile.id, 
                    profile.email, 
                    token
                );
                
                if (count > 0) {
                    await LocalStorageService.markAsSynced(freshLocalEmails.map(e => e.id));
                }
                
                // CRITICAL: Ensure local identity is updated for filtered views (Atomic Ownership)
                await LocalStorageService.updateOwnership(freshLocalEmails.map(e => e.id), profile.email);
                
                logger.log(`[useAuthSync] Successfully synced ${count} emails`);
            } catch (syncErr) {
                logger.warn('[useAuthSync] History upload failed (non-blocking):', syncErr);
            }
        }

        // 5. Update Last Logged In Marker
        await LocalStorageService.updateSettings({ [CONSTANTS.STORAGE_KEYS.LAST_LOGGED_IN_EMAIL]: profile.email });
        
        return true;
    }, [t]);

    return { handlePostLoginSync };
};
