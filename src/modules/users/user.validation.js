import { z } from 'zod';

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VET', 'PET_OWNER']).optional(),
    search: z.string().optional(),
  }),
};

export const createUserSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VET', 'PET_OWNER']),
  }),
};

export const updateUserSchema = {
  params: idParam.params,
  body: z
    .object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional(),
      role: z.enum(['SUPER_ADMIN', 'ADMIN', 'VET', 'PET_OWNER']).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
