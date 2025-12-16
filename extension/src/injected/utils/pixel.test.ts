import { describe, it, expect, beforeEach } from 'vitest';
import { createPixel, getConfig } from './pixel';
import { API_CONFIG } from '../../config/api';

describe('pixel utils', () => {
    describe('createPixel', () => {
        it('should create a valid pixel image tag', () => {
            const trackId = 'test-id-123';
            const host = 'http://localhost:3000';
            const pixelBase = '/track.gif';

            const result = createPixel(trackId, host, pixelBase);

            expect(result).toContain('<img');
            expect(result).toContain(`src="${host}${pixelBase}?id=${trackId}`);
            expect(result).toContain('data-track-id="test-id-123"');
            expect(result).toContain('display:none');
        });

        it('should sanitize trackId', () => {
            const unsafeId = 'test<script>alert(1)</script>';
            const host = 'http://localhost:3000';
            const pixelBase = '/track.gif';

            const result = createPixel(unsafeId, host, pixelBase);

            expect(result).not.toContain('<script>');
            expect(result).toContain('data-track-id="testscriptalert1script"');
        });
    });

    describe('getConfig', () => {
        beforeEach(() => {
            document.body.innerHTML = '';
        });

        it('should return config from DOM element if present', () => {
            const div = document.createElement('div');
            div.id = 'emailtrack-config';
            div.setAttribute('data-api-url', 'https://api.example.com');
            document.body.appendChild(div);

            const config = getConfig();
            expect(config.HOST).toBe('https://api.example.com');
            expect(config.PIXEL_BASE).toBe(API_CONFIG.ENDPOINTS.PIXEL_PATH);
        });

        it('should fallback to API_CONFIG if DOM element missing', () => {
            const config = getConfig();
            expect(config.HOST).toBe(API_CONFIG.BASE_URL);
            expect(config.PIXEL_BASE).toBe(API_CONFIG.ENDPOINTS.PIXEL_PATH);
        });
    });
});
