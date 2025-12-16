
import { API_CONFIG } from '../../config/api';

export const getConfig = () => {
    const configEl = document.getElementById('emailtrack-config');
    const domUrl = configEl?.getAttribute('data-api-url');
    // Fallback if DOM not ready yet
    return {
        HOST: domUrl || API_CONFIG.BASE_URL,
        PIXEL_BASE: API_CONFIG.ENDPOINTS.PIXEL_PATH
    };
};

export function createPixel(trackId: string, host: string, pixelBase: string): string {
    // Sanitize trackId just in case, though it's a UUID
    const safeId = trackId.replace(/[^a-zA-Z0-9-]/g, '');
    const url = `${host}${pixelBase}?id=${safeId}&t=${Date.now()}`;
    return `<img src="${url}" alt="" width="1" height="1" style="display:none;" data-track-id="${safeId}" />`;
}
