import { Router } from 'express';
import { serviceController } from './service.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
  idParam,
  listServicesSchema,
  createServiceSchema,
  updateServiceSchema,
} from './service.validation.js';

const router = Router();

// Reading services is open to any authenticated user (e.g. owners while booking).
router.get('/', authenticate, validate(listServicesSchema), serviceController.list);
router.get('/:id', authenticate, validate(idParam), serviceController.getById);

// Services are owned and managed by the vet that offers them — not by admins.
// (Super admins may also edit/remove for moderation; ownership is enforced in
// the service layer.)
router.post('/', authenticate, authorize('VET'), validate(createServiceSchema), serviceController.create);
router.patch(
  '/:id',
  authenticate,
  authorize('VET', 'SUPER_ADMIN'),
  validate(updateServiceSchema),
  serviceController.update,
);
router.delete(
  '/:id',
  authenticate,
  authorize('VET', 'SUPER_ADMIN'),
  validate(idParam),
  serviceController.remove,
);

export default router;
