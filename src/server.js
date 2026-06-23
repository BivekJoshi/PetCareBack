import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/prisma.js';
import { logger } from './utils/logger.js';
import { initSocket, getIO } from './socket/index.js';
import { startMessageRetentionJob } from './jobs/messageRetention.job.js';

const start = async () => {
  try {
    await connectDatabase();
    logger.info('Connected to PostgreSQL');

    // Wrap Express in an HTTP server so Socket.IO can share the same port.
    const server = http.createServer(app);
    initSocket(server);

    // Background sweeper that permanently deletes messages older than the
    // admin-configured retention window (default 50 days).
    const stopRetentionJob = startMessageRetentionJob();

    server.listen(env.port, () => {
      logger.info(`PetCare API running on http://localhost:${env.port} [${env.nodeEnv}]`);
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return; // ignore a second signal mid-shutdown
      shuttingDown = true;
      logger.warn(`${signal} received — shutting down gracefully`);
      stopRetentionJob();
      // Disconnect Socket.IO clients first; otherwise their open connections
      // keep server.close() from ever completing (nodemon would then SIGTERM
      // again and report a false "crash").
      getIO()?.close();
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Closed DB connection. Bye.');
        process.exit(0);
      });
      // Force exit if cleanup hangs. This is still a clean shutdown, so exit 0.
      setTimeout(() => process.exit(0), 10_000).unref();
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
