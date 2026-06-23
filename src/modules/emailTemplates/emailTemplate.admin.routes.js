import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware.js';
import { authorize } from '../../middlewares/auth.middleware.js';
import { emailTemplateAdminController } from './emailTemplate.admin.controller.js';
import { templateKeyParam, updateEmailTemplateSchema } from './emailTemplate.validation.js';

// Control-Panel routes for editing transactional-email templates. Mounted by the
// admin router under /admin/email-templates; authentication is applied there, so
// here we only add the super-admin gate. Keeping these in the module keeps all
// email-template logic in one place.
const router = Router();

router.use(authorize('SUPER_ADMIN'));

router.get('/', emailTemplateAdminController.list);
router.get('/:key', validate(templateKeyParam), emailTemplateAdminController.get);
router.put('/:key', validate(updateEmailTemplateSchema), emailTemplateAdminController.update);
router.post('/:key/reset', validate(templateKeyParam), emailTemplateAdminController.reset);

export default router;
