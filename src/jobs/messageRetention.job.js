import { settingsService } from '../modules/admin/settings.service.js';
import { logger } from '../utils/logger.js';

// How often the purge sweep runs. The retention *window* (how old a message
// must be before deletion) is admin-configurable; this is just the polling
// cadence of the sweeper itself. Once a day is plenty.
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
// Small delay after boot so we don't compete with startup work.
const INITIAL_DELAY_MS = 60 * 1000; // 1 min

const runPurge = async () => {
  try {
    await settingsService.purgeOldMessages();
  } catch (err) {
    logger.error('Message retention purge failed:', err);
  }
};

/**
 * Start the background chat-retention sweeper. Runs once shortly after boot,
 * then on a fixed daily interval. Returns a stop() handle for graceful shutdown.
 */
export const startMessageRetentionJob = () => {
  const initial = setTimeout(runPurge, INITIAL_DELAY_MS);
  const interval = setInterval(runPurge, PURGE_INTERVAL_MS);
  // Don't let these timers keep the process alive on their own.
  initial.unref?.();
  interval.unref?.();

  logger.info('Chat retention sweeper started (daily)');

  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
};
