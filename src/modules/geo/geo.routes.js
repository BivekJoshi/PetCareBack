import { Router } from 'express';
import { geoController } from './geo.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveLinkSchema } from './geo.validation.js';

const router = Router();

// Any signed-in user can resolve a pasted Google Maps link to coordinates.
router.post(
  '/resolve-link',
  authenticate,
  validate(resolveLinkSchema),
  geoController.resolveLink,
);

export default router;
