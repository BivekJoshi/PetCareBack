import { Router } from 'express';
import { roleRequestFieldController } from './role-request-field.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
  idParam,
  listFieldsSchema,
  createFieldSchema,
  updateFieldSchema,
} from './role-request-field.validation.js';

const router = Router();

router.use(authenticate);

// Any signed-in user can read the field config (to render the request form).
router.get('/', validate(listFieldsSchema), roleRequestFieldController.list);

// Only admins configure the fields.
const adminOnly = [authorize('ADMIN', 'SUPER_ADMIN')];
router.post('/', ...adminOnly, validate(createFieldSchema), roleRequestFieldController.create);
router.patch('/:id', ...adminOnly, validate(updateFieldSchema), roleRequestFieldController.update);
router.delete('/:id', ...adminOnly, validate(idParam), roleRequestFieldController.remove);

export default router;
