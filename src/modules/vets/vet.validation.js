import { z } from 'zod';

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listVetsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isAvailable: z.coerce.boolean().optional(),
    search: z.string().optional(),
  }),
};

// Creates a User with role VET plus an attached Vet profile.
export const createVetSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    specialization: z.string().optional(),
    licenseNumber: z.string().optional(),
    bio: z.string().optional(),
    yearsExp: z.number().int().min(0).optional(),
  }),
};

export const updateVetSchema = {
  params: idParam.params,
  body: z
    .object({
      specialization: z.string().optional(),
      licenseNumber: z.string().optional(),
      bio: z.string().optional(),
      yearsExp: z.number().int().min(0).optional(),
      isAvailable: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
