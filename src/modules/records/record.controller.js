import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { recordService } from './record.service.js';

export const recordController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await recordService.list(req.query, req.user);
    sendSuccess(res, { message: 'Records fetched', data: { items, meta } });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await recordService.create(req.body, req.user);
    sendSuccess(res, { statusCode: 201, message: 'Record added', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await recordService.remove(req.params.id, req.user);
    sendSuccess(res, { message: 'Record deleted' });
  }),
};
