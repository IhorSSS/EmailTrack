
import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    PORT: Number(process.env.PORT) || 3000,
    CORS_ORIGINS: [
        'http://localhost:3000',
        'http://localhost:5173',
        /^chrome-extension:\/\/.*$/
    ],
    RATE_LIMIT: {
        MAX: 100,
        WINDOW: '1 minute',
        CACHE: 10000,
        ALLOW_LIST: ['127.0.0.1']
    },
    GOOGLE: {
        CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'MISSING_CLIENT_ID',
        // In production, we should probably fetch this or error if missing
    }
};
