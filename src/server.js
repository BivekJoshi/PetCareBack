import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/prisma.js';
import { logger } from './utils/logger.js';

const start = async () => {
  try {
    await connectDatabase();
    logger.info('Connected to PostgreSQL');

    const server = app.listen(env.port, () => {
      logger.info(`PetCare API running on http://localhost:${env.port} [${env.nodeEnv}]`);
    });

    const shutdown = async (signal) => {
      logger.warn(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Closed DB connection. Bye.');
        process.exit(0);
      });
      // Force exit if cleanup hangs.
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error('Failed to start server', err);
    await disconnectDatabase();
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

start();
