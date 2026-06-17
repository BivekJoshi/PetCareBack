import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { vaccinationService } from './vaccination.service.js';

export const vaccinationController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await vaccinationService.list(req.query, req.user);
    sendSuccess(res, { message: 'Vaccinations fetched', data: { items, meta } });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await vaccinationService.create(req.body, req.user);
    sendSuccess(res, { statusCode: 201, message: 'Vaccination recorded', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await vaccinationService.update(req.params.id, req.body, req.user);
    sendSuccess(res, { message: 'Vaccination updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await vaccinationService.remove(req.params.id, req.user);
    sendSuccess(res, { message: 'Vaccination deleted' });
  }),
};
