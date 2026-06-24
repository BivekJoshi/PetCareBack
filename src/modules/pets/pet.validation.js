import { z } from 'zod';

const GENDER = ['MALE', 'FEMALE', 'UNKNOWN'];

// Species is now an admin-managed catalogue (the Species table), so we accept
// any non-empty key here and verify it exists/active in the pet service.
const species = z.string().trim().min(1).optional();

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const lookupCodeSchema = {
  params: z.object({ code: z.string().min(3, 'Pet code is required') }),
};

const geoFields = {
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  areaId: z.string().uuid().optional(),
};

const sharedFields = {
  breed: z.string().optional(),
  gender: z.enum(GENDER).optional(),
  birthDate: z.coerce.date().optional(),
  weightKg: z.number().positive().optional(),
  color: z.string().optional(),
  microchipId: z.string().optional(),
  photoUrl: z.string().url().optional(),
  isSterilized: z.boolean().optional(),
  notes: z.string().optional(),
  ...geoFields,
};

export const listPetsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    species,
    search: z.string().optional(),
  }),
};

export const createPetSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    species,
    ...sharedFields,
    // Admins may assign an owner; owners default to themselves (set in controller).
    ownerId: z.string().uuid().optional(),
  }),
};

export const updatePetSchema = {
  params: idParam.params,
  body: z
    .object({
      name: z.string().min(1).optional(),
      species,
      ...sharedFields,
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' }),
};
