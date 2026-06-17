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

// Reading the catalogue is open to any authenticated user.
router.get('/', authenticate, validate(listServicesSchema), serviceController.list);
router.get('/:id', authenticate, validate(idParam), serviceController.getById);

// Mutations are admin-only.
const adminOnly = [authenticate, authorize('ADMIN', 'SUPER_ADMIN')];
router.post('/', ...adminOnly, validate(createServiceSchema), serviceController.create);
router.patch('/:id', ...adminOnly, validate(updateServiceSchema), serviceController.update);
router.delete('/:id', ...adminOnly, validate(idParam), serviceController.remove);

export default router;
