import { z } from 'zod';

const STATUS = ['SCHEDULED', 'ADMINISTERED', 'OVERDUE', 'SKIPPED'];

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listVaccinationsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    petId: z.string().uuid().optional(),
    status: z.enum(STATUS).optional(),
  }),
};

export const createVaccinationSchema = {
  body: z.object({
    petId: z.string().uuid('A pet is required'),
    vaccineName: z.string().min(1, 'Vaccine name is required'),
    doseNumber: z.number().int().min(1).optional(),
    status: z.enum(STATUS).optional(),
    administeredAt: z.coerce.date().optional(),
    nextDueAt: z.coerce.date().optional(),
    batchNo: z.string().optional(),
    isSubsidized: z.boolean().optional(),
    notes: z.string().optional(),
    vetId: z.string().uuid().optional(),
  }),
};

export const updateVaccinationSchema = {
  params: idParam.params,
  body: z
    .object({
      vaccineName: z.string().min(1).optional(),
      doseNumber: z.number().int().min(1).optional(),
      status: z.enum(STATUS).optional(),
      administeredAt: z.coerce.date().optional(),
      nextDueAt: z.coerce.date().optional(),
      batchNo: z.string().optional(),
      isSubsidized: z.boolean().optional(),
      notes: z.string().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
