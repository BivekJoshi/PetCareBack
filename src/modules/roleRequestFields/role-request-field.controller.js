import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { roleRequestFieldService } from './role-request-field.service.js';

export const roleRequestFieldController = {
  list: asyncHandler(async (req, res) => {
    const data = await roleRequestFieldService.list(req.query);
    sendSuccess(res, { message: 'Role-request fields fetched', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await roleRequestFieldService.create(req.body);
    sendSuccess(res, { statusCode: 201, message: 'Field created', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await roleRequestFieldService.update(req.params.id, req.body);
    sendSuccess(res, { message: 'Field updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await roleRequestFieldService.remove(req.params.id);
    sendSuccess(res, { message: 'Field deleted' });
  }),
};
