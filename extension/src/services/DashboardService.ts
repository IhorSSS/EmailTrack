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
    /**
     * Fetch tracked emails from the server.
     */
    async fetchEmails(params: URLSearchParams, token?: string | null): Promise<TrackedEmail[]> {
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}?${params.toString()}`, {
            cache: 'no-store',
            headers
        });

        if (!res.ok) {
            const err: any = new Error(`HTTP ${res.status}: ${res.statusText}`);
            err.status = res.status;
            throw err;
        }

        const { data } = await res.json();
        return data || [];
    },

    /**
     * Delete emails or clear history.
     */
    async deleteEmails(params: URLSearchParams, token?: string | null): Promise<void> {
        const urlBase = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}`;
        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${urlBase}?${params.toString()}`, {
            method: 'DELETE',
            headers
        });

        if (!res.ok) {
            const err: any = new Error(`API_ERROR: Failed to delete tracking (Status ${res.status})`);
            err.status = res.status;
            throw err;
        }
    },

    /**
     * Efficiently sync status for a list of IDs (Anonymous/Local Mode).
     * Uses POST to avoid URL length limits and returns limited metadata.
     */
    async syncStatus(ids: string[]): Promise<any[]> {
        if (ids.length === 0) return [];

        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DASHBOARD}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids })
        });

        if (!res.ok) {
            throw new Error(`Sync failed: ${res.status}`);
        }

        const { data } = await res.json();
        return data || [];
    }
};
