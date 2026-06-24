import { z } from 'zod';

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'Use a hex colour like #0E9594');

export const createSpeciesSchema = {
  body: z.object({
    // Normalised to an UPPER_SNAKE code; this is what gets stored on pets.
    key: z
      .string()
      .trim()
      .min(2, 'Key is too short')
      .max(30)
      .transform((s) => s.toUpperCase().replace(/\s+/g, '_'))
      .refine((s) => /^[A-Z0-9_]+$/.test(s), {
        message: 'Key may contain only letters, numbers and underscores',
      }),
    name: z.string().trim().min(1, 'Name is required').max(40),
    emoji: z.string().trim().max(8).optional(),
    tint: hexColor.optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
};

// `key` is immutable once created (pets reference it), so it isn't editable here.
export const updateSpeciesSchema = {
  params: idParam.params,
  body: z
    .object({
      name: z.string().trim().min(1).max(40).optional(),
      emoji: z.string().trim().max(8).optional(),
      tint: hexColor.optional(),
      sortOrder: z.coerce.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
