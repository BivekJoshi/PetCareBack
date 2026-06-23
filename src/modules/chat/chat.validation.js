import { z } from 'zod';

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const listContactsSchema = {
  query: z.object({ search: z.string().optional() }),
};

export const threadSchema = {
  params: z.object({ userId: z.string().uuid('Invalid user id') }),
  query: pagination,
};

export const markReadSchema = {
  params: z.object({ userId: z.string().uuid('Invalid user id') }),
};

export const broadcastListSchema = {
  query: pagination,
};

// An uploaded attachment's metadata (returned by POST /chat/upload).
const attachmentSchema = z.object({
  url: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
});

// A message needs text, an attachment, or both.
const hasBody = (v) => Boolean(v.content?.trim()) || Boolean(v.attachment);

export const sendDirectSchema = {
  body: z
    .object({
      recipientId: z.string().uuid('Invalid recipient id'),
      content: z.string().trim().max(4000).optional().default(''),
      attachment: attachmentSchema.optional(),
      replyToId: z.string().uuid().optional(),
    })
    .refine(hasBody, { message: 'Message cannot be empty' }),
};

export const sendBroadcastSchema = {
  body: z
    .object({
      content: z.string().trim().max(4000).optional().default(''),
      attachment: attachmentSchema.optional(),
      replyToId: z.string().uuid().optional(),
    })
    .refine(hasBody, { message: 'Message cannot be empty' }),
};

export const editMessageSchema = {
  params: z.object({ id: z.string().uuid('Invalid message id') }),
  body: z.object({
    content: z.string().trim().min(1, 'Message cannot be empty').max(4000),
  }),
};

export const deleteMessageSchema = {
  params: z.object({ id: z.string().uuid('Invalid message id') }),
  query: z.object({ scope: z.enum(['me', 'everyone']).default('me') }),
};

export const forwardMessageSchema = {
  params: z.object({ id: z.string().uuid('Invalid message id') }),
  body: z.object({ recipientId: z.string().uuid('Invalid recipient id') }),
};

export const setNicknameSchema = {
  params: z.object({ userId: z.string().uuid('Invalid user id') }),
  body: z.object({ label: z.string().trim().min(1, 'Nickname required').max(60) }),
};

export const userIdParamSchema = {
  params: z.object({ userId: z.string().uuid('Invalid user id') }),
};

export const registerDeviceSchema = {
  body: z.object({
    token: z.string().min(1, 'Device token is required'),
    platform: z.enum(['web', 'android', 'ios']).optional(),
  }),
};

export const removeDeviceSchema = {
  body: z.object({ token: z.string().min(1, 'Device token is required') }),
};
