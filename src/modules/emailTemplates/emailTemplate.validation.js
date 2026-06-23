import { z } from 'zod';

export const templateKeyParam = {
  params: z.object({ key: z.string().min(1, 'A template key is required') }),
};

export const updateEmailTemplateSchema = {
  params: z.object({ key: z.string().min(1, 'A template key is required') }),
  body: z.object({
    subject: z.string().trim().min(1, 'Subject is required').max(255, 'Subject is too long'),
    html: z.string().min(1, 'Template HTML is required'),
  }),
};
