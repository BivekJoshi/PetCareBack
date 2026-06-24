import { z } from 'zod';

const STATUS = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listAppointmentsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(STATUS).optional(),
    petId: z.string().uuid().optional(),
    vetId: z.string().uuid().optional(),
  }),
};

// Optional location the owner is requesting the visit from.
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const createAppointmentSchema = {
  body: z.object({
    petId: z.string().uuid('A valid pet id is required'),
    scheduledAt: z.coerce.date(),
    vetId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
  }),
};

export const updateAppointmentSchema = {
  params: idParam.params,
  body: z
    .object({
      scheduledAt: z.coerce.date().optional(),
      vetId: z.string().uuid().nullable().optional(),
      serviceId: z.string().uuid().nullable().optional(),
      reason: z.string().optional(),
      notes: z.string().optional(),
      latitude: latitude.nullable().optional(),
      longitude: longitude.nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};

export const updateStatusSchema = {
  params: idParam.params,
  body: z.object({
    status: z.enum(STATUS),
  }),
};
