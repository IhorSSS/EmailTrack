import { buildApp } from './app';
import { CONFIG } from './config';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
dotenv.config();

const start = async () => {
    const app = buildApp();
    try {
        const port = CONFIG.PORT;
        await app.listen({ port, host: '0.0.0.0' });
        logger.info(`Server listening on port ${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
