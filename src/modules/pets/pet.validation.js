import { z } from 'zod';

const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'REPTILE', 'FISH', 'OTHER'];
const GENDER = ['MALE', 'FEMALE', 'UNKNOWN'];

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listPetsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    species: z.enum(SPECIES).optional(),
    search: z.string().optional(),
  }),
};

export const createPetSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    species: z.enum(SPECIES).optional(),
    breed: z.string().optional(),
    gender: z.enum(GENDER).optional(),
    birthDate: z.coerce.date().optional(),
    weightKg: z.number().positive().optional(),
    notes: z.string().optional(),
    // Admins may assign an owner; owners default to themselves (set in controller).
    ownerId: z.string().uuid().optional(),
  }),
};

export const updatePetSchema = {
  params: idParam.params,
  body: z
    .object({
      name: z.string().min(1).optional(),
      species: z.enum(SPECIES).optional(),
      breed: z.string().optional(),
      gender: z.enum(GENDER).optional(),
      birthDate: z.coerce.date().optional(),
      weightKg: z.number().positive().optional(),
      notes: z.string().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
