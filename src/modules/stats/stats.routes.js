import { Router } from 'express';
import { z } from 'zod';
import { statsController } from './stats.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const byAreaSchema = {
  query: z.object({
    level: z.enum(['PROVINCE', 'DISTRICT', 'MUNICIPALITY', 'WARD']).optional(),
    parentId: z.string().uuid().optional(),
  }),
};

const router = Router();

// Government dashboards — administrators only.
router.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/overview', statsController.overview);
router.get('/by-area', validate(byAreaSchema), statsController.byArea);

export default router;
