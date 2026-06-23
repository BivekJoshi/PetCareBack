import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { settingsService } from './settings.service.js';

export const settingsController = {
  getRetention: asyncHandler(async (_req, res) => {
    const data = await settingsService.getRetention();
    sendSuccess(res, { message: 'Chat retention policy', data });
  }),

  updateRetention: asyncHandler(async (req, res) => {
    const data = await settingsService.updateRetention(req.body, req.user.id);
    sendSuccess(res, { message: 'Chat retention policy updated', data });
  }),

  // Manually trigger a purge right now (button in the control panel).
  purgeNow: asyncHandler(async (_req, res) => {
    const result = await settingsService.purgeOldMessages();
    const setting = await settingsService.getRetention();
    sendSuccess(res, {
      message: result.skipped
        ? 'Purge skipped — retention is disabled'
        : `Purged ${result.deleted} old message(s)`,
      data: { result, setting },
    });
  }),
};
