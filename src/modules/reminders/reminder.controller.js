import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { reminderService } from './reminder.service.js';

export const reminderController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await reminderService.list(req.query, req.user);
    sendSuccess(res, { message: 'Reminders fetched', data: { items, meta } });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await reminderService.create(req.body, req.user);
    sendSuccess(res, { statusCode: 201, message: 'Reminder created', data });
  }),

  markRead: asyncHandler(async (req, res) => {
    const data = await reminderService.markRead(req.params.id, req.user);
    sendSuccess(res, { message: 'Reminder marked as read', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await reminderService.remove(req.params.id, req.user);
    sendSuccess(res, { message: 'Reminder dismissed' });
  }),
};
