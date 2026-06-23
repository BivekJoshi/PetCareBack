import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { authService } from './auth.service.js';

export const authController = {
  register: asyncHandler(async (req, res) => {
    const data = await authService.register(req.body);
    sendSuccess(res, { statusCode: 201, message: 'Registration successful', data });
  }),

  login: asyncHandler(async (req, res) => {
    const data = await authService.login(req.body);
    sendSuccess(res, { message: 'Login successful', data });
  }),

  refresh: asyncHandler(async (req, res) => {
    const data = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, { message: 'Token refreshed', data });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.user.id);
    sendSuccess(res, { message: 'Logged out successfully' });
  }),

  me: asyncHandler(async (req, res) => {
    const data = await authService.me(req.user.id);
    sendSuccess(res, { message: 'Current user', data });
  }),

  config: asyncHandler(async (_req, res) => {
    const data = await authService.publicConfig();
    sendSuccess(res, { message: 'Auth config', data });
  }),

  sendPhoneOtp: asyncHandler(async (req, res) => {
    const data = await authService.issueOtp('phone', req.user.id);
    sendSuccess(res, { message: 'Verification code sent via WhatsApp', data });
  }),

  verifyPhoneOtp: asyncHandler(async (req, res) => {
    const user = await authService.verifyOtp('phone', req.user.id, req.body.code);
    sendSuccess(res, { message: 'Phone number verified', data: { user } });
  }),

  sendEmailOtp: asyncHandler(async (req, res) => {
    const data = await authService.issueOtp('email', req.user.id);
    sendSuccess(res, { message: 'Verification code sent to your email', data });
  }),

  verifyEmailOtp: asyncHandler(async (req, res) => {
    const user = await authService.verifyOtp('email', req.user.id, req.body.code);
    sendSuccess(res, { message: 'Email verified', data: { user } });
  }),
};
