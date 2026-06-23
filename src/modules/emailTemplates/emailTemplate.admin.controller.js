import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { emailTemplateService } from './emailTemplate.service.js';

// Control-Panel handlers for editing transactional-email templates (super admin).
export const emailTemplateAdminController = {
  list: asyncHandler(async (_req, res) => {
    const data = await emailTemplateService.list();
    sendSuccess(res, { message: 'Email templates', data });
  }),

  get: asyncHandler(async (req, res) => {
    const data = await emailTemplateService.get(req.params.key);
    sendSuccess(res, { message: 'Email template', data });
  }),

  update: asyncHandler(async (req, res) => {
    const data = await emailTemplateService.update(req.params.key, req.body, req.user.id);
    sendSuccess(res, { message: 'Email template saved', data });
  }),

  reset: asyncHandler(async (req, res) => {
    const data = await emailTemplateService.reset(req.params.key, req.user.id);
    sendSuccess(res, { message: 'Email template reset to default', data });
  }),
};
