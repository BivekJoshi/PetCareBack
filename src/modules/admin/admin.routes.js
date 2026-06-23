import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { updateRetentionSchema } from './settings.validation.js';

const router = Router();

// The entire admin control panel is restricted to government / super admins.
router.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

// Chat-retention control panel
router.get('/chat-retention', settingsController.getRetention);
router.put('/chat-retention', validate(updateRetentionSchema), settingsController.updateRetention);
router.post('/chat-retention/purge', settingsController.purgeNow);

export default router;
