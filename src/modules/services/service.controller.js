import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { serviceService } from './service.service.js';

export const serviceController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await serviceService.list(req.query);
    sendSuccess(res, { message: 'Services fetched', data: { items, meta } });
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await serviceService.getById(req.params.id);
    sendSuccess(res, { message: 'Service fetched', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await serviceService.create(req.body);
    sendSuccess(res, { statusCode: 201, message: 'Service created', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await serviceService.update(req.params.id, req.body);
    sendSuccess(res, { message: 'Service updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await serviceService.remove(req.params.id);
    sendSuccess(res, { message: 'Service deleted' });
  }),
};
