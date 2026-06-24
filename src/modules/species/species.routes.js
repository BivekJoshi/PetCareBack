import { Router } from 'express';
import { speciesController } from './species.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
  idParam,
  createSpeciesSchema,
  updateSpeciesSchema,
} from './species.validation.js';

const router = Router();

// Public — the species picker and the landing page read this without auth.
router.get('/', speciesController.listPublic);

// Everything below is admin-only.
router.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/all', speciesController.listAll);
router.post('/', validate(createSpeciesSchema), speciesController.create);
router.patch('/:id', validate(updateSpeciesSchema), speciesController.update);
router.delete('/:id', validate(idParam), speciesController.remove);

export default router;
