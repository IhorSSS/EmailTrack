import { useEffect } from 'react';
import { CONSTANTS } from '../../config/constants';
import { logger } from '../../utils/logger';

export const useEmailSync = (
    settingsLoaded: boolean,
    fetchEmails: () => Promise<void>
) => {
    useEffect(() => {
        if (settingsLoaded) {
            fetchEmails();

            const pollInterval = setInterval(() => {
                logger.log('[useEmailSync] Periodic sync starting...');
                fetchEmails();
            }, CONSTANTS.INTERVALS.POLLING_MS);

            return () => clearInterval(pollInterval);
        }
    }, [settingsLoaded, fetchEmails]);
};
