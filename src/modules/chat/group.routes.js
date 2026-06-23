import { Router } from 'express';
import { groupController } from './group.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  createGroupSchema,
  groupIdParam,
  groupMessagesSchema,
  sendGroupSchema,
  addMembersSchema,
  removeMemberSchema,
  renameGroupSchema,
} from './group.validation.js';

// Mounted under /chat/groups (parent router already requires auth, but we
// authenticate here too so this file is self-contained).
const router = Router();
router.use(authenticate);

router.get('/', groupController.list);
router.post('/', validate(createGroupSchema), groupController.create);

router.get('/:id', validate(groupIdParam), groupController.getOne);
router.patch('/:id', validate(renameGroupSchema), groupController.rename);
router.post('/:id/leave', validate(groupIdParam), groupController.leave);

router.get('/:id/messages', validate(groupMessagesSchema), groupController.messages);
router.post('/:id/messages', validate(sendGroupSchema), groupController.send);

router.get('/:id/members', validate(groupIdParam), groupController.members);
router.post('/:id/members', validate(addMembersSchema), groupController.addMembers);
router.delete(
  '/:id/members/:userId',
  validate(removeMemberSchema),
  groupController.removeMember,
);

export default router;
