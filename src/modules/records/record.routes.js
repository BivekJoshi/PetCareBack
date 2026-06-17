import { Router } from 'express';
import { recordController } from './record.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { idParam, listRecordsSchema, createRecordSchema } from './record.validation.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(listRecordsSchema), recordController.list);
router.post('/', validate(createRecordSchema), recordController.create);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), validate(idParam), recordController.remove);

export default router;
