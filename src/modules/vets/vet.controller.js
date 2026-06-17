import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { vetService } from './vet.service.js';

export const vetController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await vetService.list(req.query);
    sendSuccess(res, { message: 'Vets fetched', data: { items, meta } });
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await vetService.getById(req.params.id);
    sendSuccess(res, { message: 'Vet fetched', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await vetService.create(req.body);
    sendSuccess(res, { statusCode: 201, message: 'Vet created', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await vetService.update(req.params.id, req.body);
    sendSuccess(res, { message: 'Vet updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await vetService.remove(req.params.id);
    sendSuccess(res, { message: 'Vet deleted' });
  }),
};
