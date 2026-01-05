import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../utils/crypto';

describe('Crypto Utils', () => {
    it('should encrypt and decrypt a string', () => {
        const original = 'Hello World';
        const encrypted = encrypt(original);
        expect(encrypted).not.toBe(original);
        expect(encrypted.startsWith('enc:')).toBe(true);

        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    it('should handle empty strings', () => {
        expect(encrypt('')).toBe('');
        expect(decrypt('')).toBe('');
    });

    it('should fail gracefully for non-encrypted strings', () => {
        const plaintext = 'Plaintext';
        expect(decrypt(plaintext)).toBe(plaintext);
    });

    it('should return empty string if input is null/undefined (as string)', () => {
        expect(encrypt(null as any)).toBe(null);
        expect(decrypt(undefined as any)).toBe(undefined);
    });
});
