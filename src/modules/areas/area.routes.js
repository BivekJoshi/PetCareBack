import { Router } from 'express';
import { z } from 'zod';
import { areaController } from './area.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const LEVELS = ['PROVINCE', 'DISTRICT', 'MUNICIPALITY', 'WARD'];

const listSchema = {
  query: z.object({
    level: z.enum(LEVELS).optional(),
    parentId: z.string().uuid().optional(),
    search: z.string().optional(),
  }),
};

const createSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    level: z.enum(LEVELS),
    code: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    parentId: z.string().uuid().optional(),
  }),
};

const router = Router();

router.use(authenticate);

// Anyone signed in can read the hierarchy (needed for dropdowns).
router.get('/', validate(listSchema), areaController.list);
// Only administrators define the hierarchy.
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), validate(createSchema), areaController.create);

export default router;
