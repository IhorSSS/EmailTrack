
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
dotenv.config();

const pkgPath = path.resolve(__dirname, '../../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));


const getEnv = (key: string, required: boolean = false): string => {
    const value = process.env[key];
    if (required && !value) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`MISSING_ENV: ${key} is required in production`);
        }
        logger.warn(`WARNING: Missing ${key} in ${process.env.NODE_ENV} environment.`);
    }
    return value || '';
};

export const CONFIG = {
    PORT: Number(process.env.PORT) || 3000,
    BASE_URL: getEnv('BASE_URL', process.env.NODE_ENV === 'production') || 'http://localhost:3000',
    CORS_ORIGINS: (() => {
        const allowedOrigins = getEnv('CORS_ALLOWED_ORIGINS');
        const baseOrigins: (string | RegExp)[] = allowedOrigins
            ? allowedOrigins.split(',').map(o => o.trim())
            : (process.env.NODE_ENV === 'production' ? [] : [
                'http://localhost:3000',
                'http://localhost:5173',
                /^chrome-extension:\/\/.*$/ // Allow any extension in dev for easier testing
            ]);

        // Allow specific Chrome extension in all environments if ID is provided
        const extensionId = getEnv('EXTENSION_ID', false);
        if (extensionId) {
            const extOrigin = `chrome-extension://${extensionId}`;
            if (!baseOrigins.includes(extOrigin)) {
                baseOrigins.push(extOrigin);
            }
        }
        return baseOrigins;
    })(),

    RATE_LIMIT: {
        MAX: 100,
        WINDOW: '1 minute',
        CACHE: 10000,
        ALLOW_LIST: getEnv('RATE_LIMIT_ALLOW_LIST', false) 
            ? getEnv('RATE_LIMIT_ALLOW_LIST').split(',').map(ip => ip.trim()) 
            : ['127.0.0.1']
    },
    GOOGLE: {
        CLIENT_ID: getEnv('GOOGLE_CLIENT_ID', true),
    },
    // Add other secrets here as needed
    JWT_SECRET: getEnv('JWT_SECRET', process.env.NODE_ENV === 'production'),
    ENCRYPTION_KEY: getEnv('ENCRYPTION_KEY', true),
    VERSION: pkg.version || '1.0.0',
};

