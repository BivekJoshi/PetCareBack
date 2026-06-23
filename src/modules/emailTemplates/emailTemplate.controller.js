import { asyncHandler } from '../../utils/asyncHandler.js';
import { renderEmailTemplate } from './emailTemplate.service.js';

export const emailTemplateController = {
  /**
   * Render an email template to HTML with the supplied (or sample) values and
   * return it as a browser-viewable page. Lets the frontend design and preview
   * the email exactly as it will be sent. Same renderer the mailer uses.
   *
   *   GET /email-templates/:name/preview?code=123456&firstName=Jane&ttlMinutes=10
   */
  preview: asyncHandler(async (req, res) => {
    const { name } = req.params;
    const { code, firstName, ttlMinutes } = req.query;

    const { html } = await renderEmailTemplate(name, {
      code: code || '123456',
      firstName: firstName || undefined,
      ttlMinutes: ttlMinutes ? Number(ttlMinutes) : undefined,
    });

    res.type('html').send(html);
  }),
};
