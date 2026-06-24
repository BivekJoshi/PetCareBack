import { z } from 'zod';

// Roles a user is allowed to *request* for themselves. SUPER_ADMIN can never be
// self-requested, and there's no point requesting PET_OWNER (the default).
export const REQUESTABLE_ROLES = ['VET', 'ADMIN'];

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

// Coordinates arrive as multipart text fields, so coerce from string and treat
// blank/missing as "not provided" rather than 0.
const optionalCoord = (min, max) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(min).max(max).optional(),
  );

// User submits a request. Documents arrive as multipart files (parsed by multer),
// so only the text fields are validated here.
export const createRoleRequestSchema = {
  body: z.object({
    requestedRole: z.enum(REQUESTABLE_ROLES, {
      errorMap: () => ({ message: 'You can only request the VET or ADMIN role' }),
    }),
    reason: z.string().trim().max(2000).optional(),
    latitude: optionalCoord(-90, 90),
    longitude: optionalCoord(-180, 180),
  }),
};

// Admin lists requests, optionally filtered by status.
export const listRoleRequestsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
    search: z.string().optional(),
  }),
};

// Admin approves or rejects a request, optionally overriding the requested role
// (e.g. user asked for ADMIN but only VET is warranted).
export const reviewRoleRequestSchema = {
  params: idParam.params,
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED'], {
      errorMap: () => ({ message: 'Decision must be APPROVED or REJECTED' }),
    }),
    adminNote: z.string().trim().max(2000).optional(),
    // Only meaningful on approval; ignored on rejection.
    overrideRole: z.enum(['SUPER_ADMIN', 'ADMIN', 'VET', 'PET_OWNER']).optional(),
  }),
};
