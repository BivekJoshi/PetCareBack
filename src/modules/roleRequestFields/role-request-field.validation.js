import { z } from 'zod';

// Fields can only be configured for roles a user may actually request.
export const FIELD_ROLES = ['VET', 'ADMIN'];
const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT'];

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listFieldsSchema = {
  query: z.object({
    role: z.enum(FIELD_ROLES).optional(),
    includeInactive: z.coerce.boolean().optional(),
  }),
};

// A machine key: lowercase letters/numbers/underscores, used in fieldValues.
const key = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Key must start with a letter and use only letters, numbers, underscores');

const baseFieldShape = {
  role: z.enum(FIELD_ROLES),
  key,
  label: z.string().trim().min(1).max(120),
  type: z.enum(FIELD_TYPES).default('TEXT'),
  required: z.boolean().default(true),
  placeholder: z.string().trim().max(200).optional(),
  options: z.array(z.string().trim().min(1)).default([]),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
};

// SELECT fields must define at least one option.
const requireOptionsForSelect = (v, ctx) => {
  if (v.type === 'SELECT' && (!v.options || v.options.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Add at least one option for a dropdown' });
  }
};

export const createFieldSchema = {
  body: z.object(baseFieldShape).superRefine(requireOptionsForSelect),
};

export const updateFieldSchema = {
  params: idParam.params,
  body: z
    .object({
      label: baseFieldShape.label.optional(),
      type: z.enum(FIELD_TYPES).optional(),
      required: z.boolean().optional(),
      placeholder: z.string().trim().max(200).nullable().optional(),
      options: z.array(z.string().trim().min(1)).optional(),
      order: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
