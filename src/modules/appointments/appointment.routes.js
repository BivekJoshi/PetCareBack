import { Router } from 'express';
import { appointmentController } from './appointment.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  idParam,
  listAppointmentsSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  updateStatusSchema,
} from './appointment.validation.js';

const router = Router();

// Access is scoped per-role inside the service layer.
router.use(authenticate);

router.get('/', validate(listAppointmentsSchema), appointmentController.list);
router.post('/', validate(createAppointmentSchema), appointmentController.create);
router.get('/:id', validate(idParam), appointmentController.getById);
router.patch('/:id', validate(updateAppointmentSchema), appointmentController.update);
router.patch('/:id/status', validate(updateStatusSchema), appointmentController.updateStatus);
router.delete('/:id', validate(idParam), appointmentController.remove);

export default router;
