import { Router } from 'express';
import { userController } from './user.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
  idParam,
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
} from './user.validation.js';

const router = Router();

// All user-management routes are admin-only.
router.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/', validate(listUsersSchema), userController.list);
router.post('/', validate(createUserSchema), userController.create);
router.get('/:id', validate(idParam), userController.getById);
router.patch('/:id', validate(updateUserSchema), userController.update);
router.delete('/:id', validate(idParam), userController.remove);

export default router;
