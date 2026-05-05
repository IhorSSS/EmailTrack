import { describe, it, expect } from 'vitest';
import { formatRecipient, formatDateTime, getDeviceLabel } from './formatter';

describe('formatter utils', () => {
    describe('formatRecipient', () => {
        it('should handle plain strings', () => {
            expect(formatRecipient('test@example.com')).toBe('test@example.com');
        });

        it('should parse JSON recipient arrays', () => {
            const raw = '[{"name":"Ihor","address":"ihor@test.com"}]';
            expect(formatRecipient(raw)).toBe('Ihor <ihor@test.com>');
        });

        it('should fallback to address if name is missing in JSON', () => {
            const raw = '[{"address":"ihor@test.com"}]';
            expect(formatRecipient(raw)).toBe('ihor@test.com');
        });

        it('should return Unknown Recipient for empty input', () => {
            expect(formatRecipient('')).toBe('Unknown Recipient');
        });
    });

    describe('formatDateTime', () => {
        it('should format date strings', () => {
            const date = new Date();
            date.setHours(10, 30);
            const result = formatDateTime(date.toISOString(), 'en-US');
            expect(result).toContain('Today');
            expect(result).toContain('10:30');
        });
    });

    describe('getDeviceLabel', () => {
        const mockT = (key: string, params?: any) => {
            if (key === 'device_gmail') return 'Gmail Proxy';
            if (key === 'device_details') return `${params.browser} on ${params.os}`;
            return key;
        };

        it('should identify Gmail Proxy', () => {
            const device = { device: 'Gmail Image Proxy', isBot: true };
            expect(getDeviceLabel(device as any, mockT as any)).toBe('Gmail Proxy');
        });

        it('should format real device details', () => {
            const device = { browser: 'Chrome', os: 'macOS', isBot: false };
            expect(getDeviceLabel(device as any, mockT as any)).toBe('Chrome on macOS');
        });
    });
});
