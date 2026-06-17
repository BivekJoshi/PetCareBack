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
};
