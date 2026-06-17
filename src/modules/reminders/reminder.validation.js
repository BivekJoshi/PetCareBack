import { z } from 'zod';

const TYPE = ['VACCINE', 'CHECKUP', 'DEWORMING', 'CARE_TIP', 'GENERAL'];
const CHANNEL = ['PUSH', 'SMS', 'EMAIL'];
const STATUS = ['PENDING', 'SENT', 'READ', 'DISMISSED'];

export const idParam = {
  params: z.object({ id: z.string().uuid('Invalid id') }),
};

export const listRemindersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    status: z.enum(STATUS).optional(),
    type: z.enum(TYPE).optional(),
    userId: z.string().uuid().optional(),
  }),
};

export const createReminderSchema = {
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    message: z.string().min(1, 'Message is required'),
    dueAt: z.coerce.date(),
    type: z.enum(TYPE).optional(),
    channel: z.enum(CHANNEL).optional(),
    petId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  }),
};
