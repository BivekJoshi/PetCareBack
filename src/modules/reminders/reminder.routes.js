import { Router } from 'express';
import { reminderController } from './reminder.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { idParam, listRemindersSchema, createReminderSchema } from './reminder.validation.js';

const router = Router();

router.use(authenticate);

router.get('/', validate(listRemindersSchema), reminderController.list);
router.post('/', validate(createReminderSchema), reminderController.create);
router.patch('/:id/read', validate(idParam), reminderController.markRead);
router.delete('/:id', validate(idParam), reminderController.remove);

export default router;
