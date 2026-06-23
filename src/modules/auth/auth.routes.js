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
  googleAuthSchema,
  setPhoneSchema,
  setPasswordSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/google', authLimiter, validate(googleAuthSchema), authController.google);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

// Attach a phone number to the signed-in account (post Google sign-in).
router.post('/phone', authenticate, authLimiter, validate(setPhoneSchema), authController.setPhone);

// Forgot / reset password — public (no session), brute-force limited.
router.post(
  '/password/forgot',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  '/password/reset',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

// Set an initial password (OAuth accounts) or change an existing one.
router.post(
  '/password/set',
  authenticate,
  authLimiter,
  validate(setPasswordSchema),
  authController.setPassword,
);
router.post(
  '/password/change',
  authenticate,
  authLimiter,
  validate(changePasswordSchema),
  authController.changePassword,
);

// Public auth config (e.g. whether phone OTP is required) — no auth needed.
router.get('/config', authController.config);

// WhatsApp phone verification (send / resend code, then verify it).
router.post('/phone/send-otp', authenticate, authLimiter, authController.sendPhoneOtp);
router.post(
  '/phone/verify',
  authenticate,
  authLimiter,
  validate(verifyOtpSchema),
  authController.verifyPhoneOtp,
);

// Email verification (send / resend code, then verify it).
router.post('/email/send-otp', authenticate, authLimiter, authController.sendEmailOtp);
router.post(
  '/email/verify',
  authenticate,
  authLimiter,
  validate(verifyOtpSchema),
  authController.verifyEmailOtp,
);

export default router;
