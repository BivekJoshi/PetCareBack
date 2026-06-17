import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { petService } from './pet.service.js';

export const petController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await petService.list(req.query, req.user);
    sendSuccess(res, { message: 'Pets fetched', data: { items, meta } });
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await petService.getById(req.params.id, req.user);
    sendSuccess(res, { message: 'Pet fetched', data });
  }),

  lookupByCode: asyncHandler(async (req, res) => {
    const data = await petService.lookupByCode(req.params.code, req.user);
    sendSuccess(res, { message: 'Pet found', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await petService.create(req.body, req.user);
    sendSuccess(res, { statusCode: 201, message: 'Pet created', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await petService.update(req.params.id, req.body, req.user);
    sendSuccess(res, { message: 'Pet updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await petService.remove(req.params.id, req.user);
    sendSuccess(res, { message: 'Pet deleted' });
  }),
};
