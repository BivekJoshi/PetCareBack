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

// Set a password on an account that has none yet (e.g. after Google sign-in).
export const setPasswordSchema = {
  body: z
    .object({
      password: z.string().min(6, 'Password must be at least 6 characters'),
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    }),
};

// Forgot password — request a reset code by email.
export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email('A valid email is required'),
  }),
};

// Reset password — exchange the emailed code for a new password.
export const resetPasswordSchema = {
  body: z
    .object({
      email: z.string().email('A valid email is required'),
      code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    }),
};

// Change an existing password — current password required.
export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(1, 'Your current password is required'),
      newPassword: z.string().min(6, 'Password must be at least 6 characters'),
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    }),
};

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
};
