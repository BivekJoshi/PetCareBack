import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { speciesService } from './species.service.js';

export const speciesController = {
  // Public: active species with live counts.
  listPublic: asyncHandler(async (_req, res) => {
    const data = await speciesService.listPublic();
    sendSuccess(res, { message: 'Species fetched', data });
  }),

  // Admin: all species, including inactive.
  listAll: asyncHandler(async (_req, res) => {
    const data = await speciesService.listAll();
    sendSuccess(res, { message: 'Species fetched', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await speciesService.create(req.body);
    sendSuccess(res, { statusCode: 201, message: 'Species created', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await speciesService.update(req.params.id, req.body);
    sendSuccess(res, { message: 'Species updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await speciesService.remove(req.params.id);
    sendSuccess(res, { message: 'Species deleted' });
  }),
};
