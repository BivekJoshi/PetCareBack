import { z } from 'zod';

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listServicesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    isActive: z.coerce.boolean().optional(),
    search: z.string().optional(),
    // Scope to one vet's services (e.g. when booking with that vet)…
    vetId: z.string().uuid().optional(),
    // …or to the signed-in vet's own services.
    mine: z.coerce.boolean().optional(),
  }),
};

export const createServiceSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    priceCents: z.number().int().min(0).default(0),
    durationMin: z.number().int().min(1).default(30),
    isActive: z.boolean().optional(),
  }),
};

export const updateServiceSchema = {
  params: idParam.params,
  body: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      priceCents: z.number().int().min(0).optional(),
      durationMin: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
