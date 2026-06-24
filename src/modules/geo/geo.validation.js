import { z } from 'zod';

export const resolveLinkSchema = {
  body: z.object({
    url: z.string().trim().min(1, 'A link is required').max(2048),
  }),
};
