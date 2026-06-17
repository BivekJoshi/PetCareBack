import { Router } from 'express';
import { vetController } from './vet.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { idParam, listVetsSchema, createVetSchema, updateVetSchema } from './vet.validation.js';

const router = Router();

// Any authenticated user can browse vets (e.g. when booking).
router.get('/', authenticate, validate(listVetsSchema), vetController.list);
router.get('/:id', authenticate, validate(idParam), vetController.getById);

// Managing vet accounts is admin-only.
const adminOnly = [authenticate, authorize('ADMIN', 'SUPER_ADMIN')];
router.post('/', ...adminOnly, validate(createVetSchema), vetController.create);
router.patch('/:id', ...adminOnly, validate(updateVetSchema), vetController.update);
router.delete('/:id', ...adminOnly, validate(idParam), vetController.remove);

export default router;
