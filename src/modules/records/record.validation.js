import { z } from 'zod';

const TYPE = ['CHECKUP', 'TREATMENT', 'PRESCRIPTION', 'DIET', 'SURGERY'];

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listRecordsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    petId: z.string().uuid().optional(),
    type: z.enum(TYPE).optional(),
  }),
};

export const createRecordSchema = {
  body: z.object({
    petId: z.string().uuid('A pet is required'),
    type: z.enum(TYPE).optional(),
    diagnosis: z.string().optional(),
    treatment: z.string().optional(),
    medicine: z.string().optional(),
    diet: z.string().optional(),
    instructions: z.string().optional(),
    appointmentId: z.string().uuid().optional(),
    vetId: z.string().uuid().optional(),
  }),
};
