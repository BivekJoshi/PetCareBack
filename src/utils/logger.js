/* Minimal structured logger. Swap for pino/winston as the app grows. */
const ts = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(`[INFO] ${ts()}`, ...args),
  warn: (...args) => console.warn(`[WARN] ${ts()}`, ...args),
  error: (...args) => console.error(`[ERROR] ${ts()}`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') console.debug(`[DEBUG] ${ts()}`, ...args);
  },
};
