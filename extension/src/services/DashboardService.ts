import { API_CONFIG } from '../config/api';
import type { TrackedEmail } from '../types';

export interface DashboardStats {
    tracked: number;
    opened: number;
    rate: number;
}

export const DashboardService = {
    /**
     * Fetch tracked emails from the server.
     */
    async fetchEmails(params: URLSearchParams): Promise<TrackedEmail[]> {
        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}?${params.toString()}`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const { data } = await res.json();
        return data || [];
    },

    /**
     * Delete emails or clear history.
     */
    async deleteEmails(params: URLSearchParams): Promise<void> {
        const urlBase = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}`;
        const res = await fetch(`${urlBase}?${params.toString()}`, { method: 'DELETE' });

        if (!res.ok) {
            throw new Error('Failed to delete history on server');
        }
    }
};
