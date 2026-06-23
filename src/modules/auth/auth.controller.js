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

  google: asyncHandler(async (req, res) => {
    const data = await authService.googleAuth(req.body.accessToken);
    sendSuccess(res, { message: 'Signed in with Google', data });
  }),

  // Attach a phone number after Google sign-in (when none is on file yet).
  setPhone: asyncHandler(async (req, res) => {
    const data = await authService.setPhone(req.user.id, req.body.phone);
    sendSuccess(res, { message: 'Phone number saved', data });
  }),

  // Forgot password — email a reset code (response is identical whether or not
  // the address is registered).
  forgotPassword: asyncHandler(async (req, res) => {
    const data = await authService.forgotPassword(req.body.email);
    sendSuccess(res, {
      message: 'If that email is registered, a reset code is on its way',
      data,
    });
  }),

  // Reset password — exchange the emailed code for a new password.
  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.email, req.body.code, req.body.password);
    sendSuccess(res, { message: 'Password reset — you can now sign in with your new password' });
  }),

  // Add a password to an account that has none yet (e.g. after Google sign-in).
  setPassword: asyncHandler(async (req, res) => {
    const data = await authService.setPassword(req.user.id, req.body.password);
    sendSuccess(res, {
      message: 'Password set — you can now sign in with your email and password too',
      data,
    });
  }),

  // Change an existing password (requires the current one).
  changePassword: asyncHandler(async (req, res) => {
    const data = await authService.changePassword(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    sendSuccess(res, { message: 'Password updated', data });
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
