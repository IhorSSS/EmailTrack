import crypto from 'crypto';
import { CONFIG } from '../config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const PREFIX = 'enc:';

/**
 * Encrypt text using AES-256-CBC
 * The IV is prepended to the ciphertext
 */
export function encrypt(text: string): string {
    if (!text) return text;

    const key = CONFIG.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
        // Fallback for dev if key is missing/too short
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CRITICAL: ENCRYPTION_KEY is missing or too short in production');
        }
        return text;
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key.substring(0, 32)), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return PREFIX + iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt text using AES-256-CBC
 * Fails gracefully returning original text if not encrypted or decryption fails
 */
export function decrypt(text: string): string {
    if (!text || !text.startsWith(PREFIX)) return text;

    const key = CONFIG.ENCRYPTION_KEY;
    if (!key || key.length < 32) return text;

    try {
        const parts = text.substring(PREFIX.length).split(':');
        if (parts.length !== 2) return text;

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key.substring(0, 32)), iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (e) {
        // Log error but return original text to avoid breaking UI for legacy data
        console.error('[Crypto] Decryption failed:', e);
        return text;
    }
}
