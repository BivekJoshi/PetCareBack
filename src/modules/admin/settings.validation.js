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
      lockoutEnabled: z.boolean().optional(),
      // Keep the policy sane: 3–20 attempts (never lock on the first typo), lock
      // for 1 minute up to 24 hours.
      lockoutMaxAttempts: z
        .number()
        .int()
        .min(3, 'Allow at least 3 attempts')
        .max(20)
        .optional(),
      lockoutDurationMinutes: z
        .number()
        .int()
        .min(1, 'Lock for at least 1 minute')
        .max(1440, 'Lock for at most 24 hours')
        .optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: 'Provide at least one setting to update',
    }),
};
