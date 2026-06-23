import { Router } from 'express';
import { emailTemplateController } from './emailTemplate.controller.js';

const router = Router();

// Render + preview a template (used for designing emails in the browser). The
// mailer renders through the same service, not this route.
router.get('/:name/preview', emailTemplateController.preview);

export default router;
