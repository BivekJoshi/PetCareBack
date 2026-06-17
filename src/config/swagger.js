import { env } from './env.js';

// ──────────────────────────────────────────────
// Reusable component schemas
// ──────────────────────────────────────────────

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'VET', 'PET_OWNER'];
const SPECIES = ['DOG', 'CAT', 'BIRD', 'RABBIT', 'REPTILE', 'FISH', 'OTHER'];
const GENDER = ['MALE', 'FEMALE', 'UNKNOWN'];
const APPT_STATUS = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

/**
 * Wraps a data schema in the standard success envelope
 *   { success: true, message, data }
 */
const envelope = (dataSchema) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string', example: 'Success' },
    data: dataSchema,
  },
});

const components = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste the `token` returned from login/register (no "Bearer " prefix needed here).',
    },
  },
  schemas: {
    // ── Generic envelopes ──────────────────────
    SuccessMessage: envelope({ nullable: true, example: null }),
    ErrorResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Resource not found' },
        errors: {
          type: 'array',
          nullable: true,
          description: 'Field-level validation errors (only on 400 validation failures).',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', example: 'email' },
              message: { type: 'string', example: 'A valid email is required' },
            },
          },
        },
      },
    },
    Pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        total: { type: 'integer', example: 42 },
        totalPages: { type: 'integer', example: 3 },
      },
    },

    // ── Domain entities ────────────────────────
    User: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        firstName: { type: 'string', example: 'Jane' },
        lastName: { type: 'string', example: 'Doe' },
        phone: { type: 'string', nullable: true, example: '+1-555-0100' },
        role: { type: 'string', enum: ROLES, example: 'PET_OWNER' },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    AuthPayload: {
      type: 'object',
      description: 'Authentication result. `token`/`tokenId` are the JWT access token (duplicated for frontend compatibility).',
      properties: {
        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
        tokenId: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
        userType: { type: 'string', enum: ROLES, example: 'PET_OWNER' },
        user: { $ref: '#/components/schemas/User' },
      },
    },
    Vet: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        userId: { type: 'string', format: 'uuid' },
        specialization: { type: 'string', nullable: true, example: 'Surgery' },
        licenseNumber: { type: 'string', nullable: true, example: 'VET-12345' },
        bio: { type: 'string', nullable: true },
        yearsExp: { type: 'integer', example: 5 },
        isAvailable: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        user: { $ref: '#/components/schemas/User' },
      },
    },
    Pet: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Rex' },
        species: { type: 'string', enum: SPECIES, example: 'DOG' },
        breed: { type: 'string', nullable: true, example: 'Labrador' },
        gender: { type: 'string', enum: GENDER, example: 'MALE' },
        birthDate: { type: 'string', format: 'date-time', nullable: true },
        weightKg: { type: 'number', nullable: true, example: 12.5 },
        notes: { type: 'string', nullable: true },
        ownerId: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    Service: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'General Checkup' },
        description: { type: 'string', nullable: true },
        priceCents: { type: 'integer', example: 4999 },
        durationMin: { type: 'integer', example: 30 },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
    Appointment: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        scheduledAt: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: APPT_STATUS, example: 'PENDING' },
        reason: { type: 'string', nullable: true },
        notes: { type: 'string', nullable: true },
        petId: { type: 'string', format: 'uuid' },
        ownerId: { type: 'string', format: 'uuid' },
        vetId: { type: 'string', format: 'uuid', nullable: true },
        serviceId: { type: 'string', format: 'uuid', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },

    // ── Request bodies ─────────────────────────
    RegisterRequest: {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        email: { type: 'string', format: 'email', example: 'jane@example.com' },
        password: { type: 'string', minLength: 6, example: 'secret123' },
        firstName: { type: 'string', example: 'Jane' },
        lastName: { type: 'string', example: 'Doe' },
        phone: { type: 'string', example: '+1-555-0100' },
        role: { type: 'string', enum: ['PET_OWNER', 'VET'], example: 'PET_OWNER' },
      },
    },
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', example: 'jane@example.com' },
        password: { type: 'string', example: 'secret123' },
      },
    },
    RefreshRequest: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' },
      },
    },
    CreateUserRequest: {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName', 'role'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        role: { type: 'string', enum: ROLES },
      },
    },
    UpdateUserRequest: {
      type: 'object',
      minProperties: 1,
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        role: { type: 'string', enum: ROLES },
        isActive: { type: 'boolean' },
      },
    },
    CreatePetRequest: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Rex' },
        species: { type: 'string', enum: SPECIES },
        breed: { type: 'string' },
        gender: { type: 'string', enum: GENDER },
        birthDate: { type: 'string', format: 'date' },
        weightKg: { type: 'number', example: 12.5 },
        notes: { type: 'string' },
        ownerId: { type: 'string', format: 'uuid', description: 'Admins only; defaults to the caller.' },
      },
    },
    UpdatePetRequest: {
      type: 'object',
      minProperties: 1,
      properties: {
        name: { type: 'string' },
        species: { type: 'string', enum: SPECIES },
        breed: { type: 'string' },
        gender: { type: 'string', enum: GENDER },
        birthDate: { type: 'string', format: 'date' },
        weightKg: { type: 'number' },
        notes: { type: 'string' },
      },
    },
    CreateVetRequest: {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        phone: { type: 'string' },
        specialization: { type: 'string' },
        licenseNumber: { type: 'string' },
        bio: { type: 'string' },
        yearsExp: { type: 'integer', minimum: 0 },
      },
    },
    UpdateVetRequest: {
      type: 'object',
      minProperties: 1,
      properties: {
        specialization: { type: 'string' },
        licenseNumber: { type: 'string' },
        bio: { type: 'string' },
        yearsExp: { type: 'integer', minimum: 0 },
        isAvailable: { type: 'boolean' },
      },
    },
    CreateServiceRequest: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'General Checkup' },
        description: { type: 'string' },
        priceCents: { type: 'integer', minimum: 0, default: 0 },
        durationMin: { type: 'integer', minimum: 1, default: 30 },
        isActive: { type: 'boolean' },
      },
    },
    UpdateServiceRequest: {
      type: 'object',
      minProperties: 1,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        priceCents: { type: 'integer', minimum: 0 },
        durationMin: { type: 'integer', minimum: 1 },
        isActive: { type: 'boolean' },
      },
    },
    CreateAppointmentRequest: {
      type: 'object',
      required: ['petId', 'scheduledAt'],
      properties: {
        petId: { type: 'string', format: 'uuid' },
        scheduledAt: { type: 'string', format: 'date-time' },
        vetId: { type: 'string', format: 'uuid' },
        serviceId: { type: 'string', format: 'uuid' },
        reason: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    UpdateAppointmentRequest: {
      type: 'object',
      minProperties: 1,
      properties: {
        scheduledAt: { type: 'string', format: 'date-time' },
        vetId: { type: 'string', format: 'uuid', nullable: true },
        serviceId: { type: 'string', format: 'uuid', nullable: true },
        reason: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    UpdateStatusRequest: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: APPT_STATUS },
      },
    },
  },

  // ── Reusable responses ───────────────────────
  responses: {
    BadRequest: {
      description: 'Validation failed / bad request',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    },
    Unauthorized: {
      description: 'Missing or invalid authentication',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    },
    Forbidden: {
      description: 'Authenticated but not permitted',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    },
    NotFound: {
      description: 'Resource not found',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
    },
  },
};

// ──────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────

const json = (schemaRef) => ({ 'application/json': { schema: schemaRef } });

const dataResponse = (ref, description = 'Success') => ({
  description,
  content: json(envelope({ $ref: ref })),
});

const listResponse = (ref, key, description = 'A paginated list') => ({
  description,
  content: json(
    envelope({
      type: 'object',
      properties: {
        [key]: { type: 'array', items: { $ref: ref } },
        pagination: { $ref: '#/components/schemas/Pagination' },
      },
    }),
  ),
});

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
];

const bodyRef = (ref) => ({ required: true, content: json({ $ref: ref }) });

const ref = (name) => `#/components/schemas/${name}`;

// ──────────────────────────────────────────────
// Paths
// ──────────────────────────────────────────────

const paths = {
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register a new account (PET_OWNER or VET)',
      security: [],
      requestBody: bodyRef(ref('RegisterRequest')),
      responses: {
        201: dataResponse(ref('AuthPayload'), 'Registration successful'),
        400: { $ref: '#/components/responses/BadRequest' },
        409: { description: 'Email already in use', content: json({ $ref: ref('ErrorResponse') }) },
      },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Log in with email & password',
      security: [],
      requestBody: bodyRef(ref('LoginRequest')),
      responses: {
        200: dataResponse(ref('AuthPayload'), 'Login successful'),
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Exchange a refresh token for new tokens',
      security: [],
      requestBody: bodyRef(ref('RefreshRequest')),
      responses: {
        200: dataResponse(ref('AuthPayload'), 'Token refreshed'),
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Revoke the current refresh token',
      responses: {
        200: { description: 'Logged out', content: json({ $ref: ref('SuccessMessage') }) },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get the currently authenticated user',
      responses: {
        200: dataResponse(ref('User'), 'Current user'),
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  '/users': {
    get: {
      tags: ['Users'],
      summary: 'List users (admin only)',
      parameters: [
        ...pageParams,
        { name: 'role', in: 'query', schema: { type: 'string', enum: ROLES } },
      ],
      responses: {
        200: listResponse(ref('User'), 'users'),
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
    post: {
      tags: ['Users'],
      summary: 'Create a user (admin only)',
      requestBody: bodyRef(ref('CreateUserRequest')),
      responses: {
        201: dataResponse(ref('User'), 'User created'),
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Get a user by id (admin only)',
      parameters: [idParam],
      responses: {
        200: dataResponse(ref('User')),
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Users'],
      summary: 'Update a user (admin only)',
      parameters: [idParam],
      requestBody: bodyRef(ref('UpdateUserRequest')),
      responses: {
        200: dataResponse(ref('User'), 'User updated'),
        400: { $ref: '#/components/responses/BadRequest' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Users'],
      summary: 'Delete a user (admin only)',
      parameters: [idParam],
      responses: {
        200: { description: 'User deleted', content: json({ $ref: ref('SuccessMessage') }) },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/pets': {
    get: {
      tags: ['Pets'],
      summary: 'List pets (scoped to the caller; admins see all)',
      parameters: [
        ...pageParams,
        { name: 'species', in: 'query', schema: { type: 'string', enum: SPECIES } },
      ],
      responses: {
        200: listResponse(ref('Pet'), 'pets'),
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Pets'],
      summary: 'Create a pet',
      requestBody: bodyRef(ref('CreatePetRequest')),
      responses: {
        201: dataResponse(ref('Pet'), 'Pet created'),
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/pets/{id}': {
    get: {
      tags: ['Pets'],
      summary: 'Get a pet by id',
      parameters: [idParam],
      responses: {
        200: dataResponse(ref('Pet')),
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Pets'],
      summary: 'Update a pet',
      parameters: [idParam],
      requestBody: bodyRef(ref('UpdatePetRequest')),
      responses: {
        200: dataResponse(ref('Pet'), 'Pet updated'),
        400: { $ref: '#/components/responses/BadRequest' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Pets'],
      summary: 'Delete a pet',
      parameters: [idParam],
      responses: {
        200: { description: 'Pet deleted', content: json({ $ref: ref('SuccessMessage') }) },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/vets': {
    get: {
      tags: ['Vets'],
      summary: 'List vets',
      parameters: [
        ...pageParams,
        { name: 'isAvailable', in: 'query', schema: { type: 'boolean' } },
      ],
      responses: {
        200: listResponse(ref('Vet'), 'vets'),
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Vets'],
      summary: 'Create a vet account (admin only)',
      requestBody: bodyRef(ref('CreateVetRequest')),
      responses: {
        201: dataResponse(ref('Vet'), 'Vet created'),
        400: { $ref: '#/components/responses/BadRequest' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/vets/{id}': {
    get: {
      tags: ['Vets'],
      summary: 'Get a vet by id',
      parameters: [idParam],
      responses: {
        200: dataResponse(ref('Vet')),
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Vets'],
      summary: 'Update a vet profile (admin only)',
      parameters: [idParam],
      requestBody: bodyRef(ref('UpdateVetRequest')),
      responses: {
        200: dataResponse(ref('Vet'), 'Vet updated'),
        400: { $ref: '#/components/responses/BadRequest' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Vets'],
      summary: 'Delete a vet (admin only)',
      parameters: [idParam],
      responses: {
        200: { description: 'Vet deleted', content: json({ $ref: ref('SuccessMessage') }) },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/services': {
    get: {
      tags: ['Services'],
      summary: 'List services',
      parameters: [
        ...pageParams,
        { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
      ],
      responses: {
        200: listResponse(ref('Service'), 'services'),
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Services'],
      summary: 'Create a service (admin only)',
      requestBody: bodyRef(ref('CreateServiceRequest')),
      responses: {
        201: dataResponse(ref('Service'), 'Service created'),
        400: { $ref: '#/components/responses/BadRequest' },
        403: { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
  '/services/{id}': {
    get: {
      tags: ['Services'],
      summary: 'Get a service by id',
      parameters: [idParam],
      responses: {
        200: dataResponse(ref('Service')),
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Services'],
      summary: 'Update a service (admin only)',
      parameters: [idParam],
      requestBody: bodyRef(ref('UpdateServiceRequest')),
      responses: {
        200: dataResponse(ref('Service'), 'Service updated'),
        400: { $ref: '#/components/responses/BadRequest' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Services'],
      summary: 'Delete a service (admin only)',
      parameters: [idParam],
      responses: {
        200: { description: 'Service deleted', content: json({ $ref: ref('SuccessMessage') }) },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },

  '/appointments': {
    get: {
      tags: ['Appointments'],
      summary: 'List appointments (scoped per role)',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: APPT_STATUS } },
        { name: 'petId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        { name: 'vetId', in: 'query', schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: listResponse(ref('Appointment'), 'appointments'),
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Appointments'],
      summary: 'Book an appointment',
      requestBody: bodyRef(ref('CreateAppointmentRequest')),
      responses: {
        201: dataResponse(ref('Appointment'), 'Appointment created'),
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/appointments/{id}': {
    get: {
      tags: ['Appointments'],
      summary: 'Get an appointment by id',
      parameters: [idParam],
      responses: {
        200: dataResponse(ref('Appointment')),
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Appointments'],
      summary: 'Update an appointment',
      parameters: [idParam],
      requestBody: bodyRef(ref('UpdateAppointmentRequest')),
      responses: {
        200: dataResponse(ref('Appointment'), 'Appointment updated'),
        400: { $ref: '#/components/responses/BadRequest' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Appointments'],
      summary: 'Cancel/delete an appointment',
      parameters: [idParam],
      responses: {
        200: { description: 'Appointment deleted', content: json({ $ref: ref('SuccessMessage') }) },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
  '/appointments/{id}/status': {
    patch: {
      tags: ['Appointments'],
      summary: 'Update appointment status',
      parameters: [idParam],
      requestBody: bodyRef(ref('UpdateStatusRequest')),
      responses: {
        200: dataResponse(ref('Appointment'), 'Status updated'),
        400: { $ref: '#/components/responses/BadRequest' },
        404: { $ref: '#/components/responses/NotFound' },
      },
    },
  },
};

// ──────────────────────────────────────────────
// OpenAPI document
// ──────────────────────────────────────────────

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'PetCare API',
    version: '1.0.0',
    description:
      'PetCare backend API (PERN stack). All responses use the envelope `{ success, message, data }`.\n\n' +
      'Authenticate via `POST /auth/login`, then click **Authorize** and paste the returned `token`.',
  },
  servers: [{ url: `http://localhost:${env.port}/api/v1`, description: 'Local (v1)' }],
  tags: [
    { name: 'Auth', description: 'Registration, login, tokens' },
    { name: 'Users', description: 'User management (admin)' },
    { name: 'Pets', description: 'Pet records' },
    { name: 'Vets', description: 'Veterinarian profiles' },
    { name: 'Services', description: 'Service catalogue' },
    { name: 'Appointments', description: 'Booking & scheduling' },
  ],
  // Applied to every operation unless overridden with `security: []`.
  security: [{ bearerAuth: [] }],
  components,
  paths,
};
