import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { areaService } from './area.service.js';

export const areaController = {
  list: asyncHandler(async (req, res) => {
    const { items } = await areaService.list(req.query);
    sendSuccess(res, { message: 'Areas fetched', data: { items } });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await areaService.create(req.body);
    sendSuccess(res, { statusCode: 201, message: 'Area created', data });
  }),
};
