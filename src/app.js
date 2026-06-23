import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { openapiSpec } from './config/swagger.js';
import { UPLOAD_DIR } from './config/upload.js';
import apiRoutes from './routes/index.js';
import { authController } from './modules/auth/auth.controller.js';
import { validate } from './middlewares/validate.middleware.js';
import { loginSchema } from './modules/auth/auth.validation.js';
import { authLimiter, apiLimiter } from './middlewares/rateLimiter.middleware.js';
import { notFoundHandler } from './middlewares/notFound.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

app.set('trust proxy', 1);

// ── API docs (Swagger UI) ──────────────────────
// Mounted before helmet so its default CSP doesn't block Swagger UI's assets.
app.get('/api/docs.json', (_req, res) => res.json(openapiSpec));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'PetCare API Docs',
    swaggerOptions: { persistAuthorization: true },
  }),
);

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

// ── Uploaded chat attachments (static) ─────────
// Override helmet's same-origin CORP so the frontend (different origin in dev)
// can load images/files directly via <img>/download links.
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    setHeaders: (res) =>
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
);

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
