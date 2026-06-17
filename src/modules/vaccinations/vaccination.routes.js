import { Router } from 'express';
import { vaccinationController } from './vaccination.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
  idParam,
  listVaccinationsSchema,
  createVaccinationSchema,
  updateVaccinationSchema,
} from './vaccination.validation.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(listVaccinationsSchema), vaccinationController.list);
router.post('/', validate(createVaccinationSchema), vaccinationController.create);
router.patch('/:id', validate(updateVaccinationSchema), vaccinationController.update);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), validate(idParam), vaccinationController.remove);

export default router;
