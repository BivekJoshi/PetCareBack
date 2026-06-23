import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { updateRetentionSchema, updateAuthSettingsSchema } from './settings.validation.js';
import emailTemplateAdminRoutes from '../emailTemplates/emailTemplate.admin.routes.js';

const router = Router();

// The entire admin control panel is restricted to government / super admins.
router.use(authenticate, authorize('ADMIN', 'SUPER_ADMIN'));

// Chat-retention control panel
router.get('/chat-retention', settingsController.getRetention);
router.put('/chat-retention', validate(updateRetentionSchema), settingsController.updateRetention);
router.post('/chat-retention/purge', settingsController.purgeNow);

// Auth settings (WhatsApp OTP master switch) — SUPER ADMIN only.
router.get('/auth-settings', authorize('SUPER_ADMIN'), settingsController.getAuthSettings);
router.put(
  '/auth-settings',
  authorize('SUPER_ADMIN'),
  validate(updateAuthSettingsSchema),
  settingsController.updateAuthSettings,
);

// Email templates (editable transactional-email UI) — the module owns its routes.
router.use('/email-templates', emailTemplateAdminRoutes);

export default router;
