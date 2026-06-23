import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authLimiter } from '../../middlewares/rateLimiter.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyOtpSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

// Public auth config (e.g. whether phone OTP is required) — no auth needed.
router.get('/config', authController.config);

// WhatsApp phone verification (send / resend code, then verify it).
router.post('/phone/send-otp', authenticate, authLimiter, authController.sendOtp);
router.post(
  '/phone/verify',
  authenticate,
  authLimiter,
  validate(verifyOtpSchema),
  authController.verifyOtp,
);

export default router;
