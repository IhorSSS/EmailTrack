
import dotenv from 'dotenv';
dotenv.config();

const getEnv = (key: string, required: boolean = false): string => {
    const value = process.env[key];
    if (required && !value) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`MISSING_ENV: ${key} is required in production`);
        }
        console.warn(`WARNING: Missing ${key} in ${process.env.NODE_ENV} environment.`);
    }
    return value || '';
};

export const CONFIG = {
    PORT: Number(process.env.PORT) || 3000,
    CORS_ORIGINS: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
        : (process.env.NODE_ENV === 'production' ? [] : [
            'http://localhost:3000',
            'http://localhost:5173',
            /^chrome-extension:\/\/.*$/
        ]),
    RATE_LIMIT: {
        MAX: 100,
        WINDOW: '1 minute',
        CACHE: 10000,
        ALLOW_LIST: ['127.0.0.1']
    },
    GOOGLE: {
        CLIENT_ID: getEnv('GOOGLE_CLIENT_ID', true),
    },
    // Add other secrets here as needed
    JWT_SECRET: getEnv('JWT_SECRET', process.env.NODE_ENV === 'production'),
};
