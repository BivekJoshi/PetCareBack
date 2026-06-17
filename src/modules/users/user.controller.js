import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { userService } from './user.service.js';

export const userController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await userService.list(req.query);
    sendSuccess(res, { message: 'Users fetched', data: { items, meta } });
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await userService.getById(req.params.id);
    sendSuccess(res, { message: 'User fetched', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await userService.create(req.body);
    sendSuccess(res, { statusCode: 201, message: 'User created', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await userService.update(req.params.id, req.body);
    sendSuccess(res, { message: 'User updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await userService.remove(req.params.id);
    sendSuccess(res, { message: 'User deleted' });
  }),
};
