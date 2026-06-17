import { Router } from 'express';
import { petController } from './pet.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  idParam,
  listPetsSchema,
  createPetSchema,
  updatePetSchema,
  lookupCodeSchema,
} from './pet.validation.js';

const router = Router();

// Any authenticated user; ownership is enforced inside the service layer.
router.use(authenticate);

router.get('/', validate(listPetsSchema), petController.list);
router.post('/', validate(createPetSchema), petController.create);
// Vet-facing: pull up a pet by its public code before treating. Must precede /:id.
router.get('/lookup/:code', validate(lookupCodeSchema), petController.lookupByCode);
router.get('/:id', validate(idParam), petController.getById);
router.patch('/:id', validate(updatePetSchema), petController.update);
router.delete('/:id', validate(idParam), petController.remove);

export default router;
