import { z } from 'zod';

// Keep the window sane: at least a day, at most ~5 years.
export const updateRetentionSchema = {
  body: z
    .object({
      retentionDays: z.number().int().min(1, 'Must keep messages at least 1 day').max(1825).optional(),
      enabled: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: 'Provide retentionDays and/or enabled',
    }),
};

export const updateAuthSettingsSchema = {
  body: z
    .object({
      otpEnabled: z.boolean().optional(),
      emailOtpEnabled: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: 'Provide otpEnabled and/or emailOtpEnabled',
    }),
};
