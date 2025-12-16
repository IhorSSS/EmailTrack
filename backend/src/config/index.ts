
import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    PORT: Number(process.env.PORT) || 3000,
    CORS_ORIGINS: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
        : (() => {
            if (process.env.NODE_ENV === 'production') {
                console.warn('WARNING: CORS_ORIGINS not set in production. Defaulting to strict.');
                return []; // Strict default in production
            }
            return [
                'http://localhost:3000',
                'http://localhost:5173',
                /^chrome-extension:\/\/.*$/
            ];
        })(),
    RATE_LIMIT: {
        MAX: 100,
        WINDOW: '1 minute',
        CACHE: 10000,
        ALLOW_LIST: ['127.0.0.1']
    },
    GOOGLE: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID || (() => {
            if (process.env.NODE_ENV === 'production') {
                console.error('CRITICAL: GOOGLE_CLIENT_ID is missing in production!');
                throw new Error('MISSING_ENV: GOOGLE_CLIENT_ID is required in production');
            }
            console.warn('WARNING: GOOGLE_CLIENT_ID missing, using mock/dummy ID for dev.');
            return 'MOCK_CLIENT_ID';
        })(),
    }
};
