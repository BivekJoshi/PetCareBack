import { z } from 'zod';

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const attachmentSchema = z.object({
  url: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export const createGroupSchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Group name is required').max(100),
    memberIds: z.array(z.string().uuid()).min(1, 'Add at least one member'),
  }),
};

export const groupIdParam = {
  params: z.object({ id: z.string().uuid('Invalid group id') }),
};

export const groupMessagesSchema = {
  params: z.object({ id: z.string().uuid('Invalid group id') }),
  query: pagination,
};

export const sendGroupSchema = {
  params: z.object({ id: z.string().uuid('Invalid group id') }),
  body: z
    .object({
      content: z.string().trim().max(4000).optional().default(''),
      attachment: attachmentSchema.optional(),
      replyToId: z.string().uuid().optional(),
    })
    .refine((v) => Boolean(v.content?.trim()) || Boolean(v.attachment), {
      message: 'Message cannot be empty',
    }),
};

export const addMembersSchema = {
  params: z.object({ id: z.string().uuid('Invalid group id') }),
  body: z.object({ memberIds: z.array(z.string().uuid()).min(1) }),
};

export const removeMemberSchema = {
  params: z.object({
    id: z.string().uuid('Invalid group id'),
    userId: z.string().uuid('Invalid user id'),
  }),
};

export const renameGroupSchema = {
  params: z.object({ id: z.string().uuid('Invalid group id') }),
  body: z.object({ name: z.string().trim().min(1).max(100) }),
};
