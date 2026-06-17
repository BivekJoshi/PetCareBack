import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { statsService } from './stats.service.js';

export const statsController = {
  overview: asyncHandler(async (_req, res) => {
    const data = await statsService.overview();
    sendSuccess(res, { message: 'Overview stats', data });
  }),

  byArea: asyncHandler(async (req, res) => {
    const data = await statsService.byArea(req.query);
    sendSuccess(res, { message: 'Per-area stats', data });
  }),
};
