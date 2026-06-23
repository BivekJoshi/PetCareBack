import { z } from 'zod';

// International phone, with or without a leading "+": 8–15 digits.
const phoneField = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid phone number with country code');

export const registerSchema = {
  body: z.object({
    email: z.string().email('A valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: phoneField,
    // Self-registration is restricted to PET_OWNER; privileged roles are created by admins.
    role: z.enum(['PET_OWNER', 'VET']).optional(),
  }),
};

export const verifyOtpSchema = {
  body: z.object({
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  }),
};

export const googleAuthSchema = {
  body: z.object({
    accessToken: z.string().min(1, 'A Google access token is required'),
  }),
};

export const setPhoneSchema = {
  body: z.object({
    phone: phoneField,
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email('A valid email is required'),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
};
