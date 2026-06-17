import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { authController } from './modules/auth/auth.controller.js';
import { validate } from './middlewares/validate.middleware.js';
import { loginSchema } from './modules/auth/auth.validation.js';
import { authLimiter, apiLimiter } from './middlewares/rateLimiter.middleware.js';
import { notFoundHandler } from './middlewares/notFound.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

app.set('trust proxy', 1);

// ── Security & parsing ─────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
if (!env.isProd) app.use(morgan('dev'));

// ── Health check ───────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'PetCare API is healthy', data: { uptime: process.uptime() } });
});

// ── Frontend compatibility alias ───────────────
// The existing PetCare frontend posts credentials to POST /authenticate.
app.post('/authenticate', authLimiter, validate(loginSchema), authController.login);

// ── API (versioned) ────────────────────────────
app.use('/api/v1', apiLimiter, apiRoutes);

// ── 404 + error handling (must be last) ────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
