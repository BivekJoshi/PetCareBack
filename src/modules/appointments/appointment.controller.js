import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { appointmentService } from './appointment.service.js';

export const appointmentController = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await appointmentService.list(req.query, req.user);
    sendSuccess(res, { message: 'Appointments fetched', data: { items, meta } });
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await appointmentService.getById(req.params.id, req.user);
    sendSuccess(res, { message: 'Appointment fetched', data });
  }),

  create: asyncHandler(async (req, res) => {
    const data = await appointmentService.create(req.body, req.user);
    sendSuccess(res, { statusCode: 201, message: 'Appointment booked', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await appointmentService.update(req.params.id, req.body, req.user);
    sendSuccess(res, { message: 'Appointment updated', data });
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const data = await appointmentService.updateStatus(req.params.id, req.body.status, req.user);
    sendSuccess(res, { message: 'Appointment status updated', data });
  }),

  remove: asyncHandler(async (req, res) => {
    await appointmentService.remove(req.params.id, req.user);
    sendSuccess(res, { message: 'Appointment deleted' });
  }),
};
