import { Router } from 'express';
import { chatController } from './chat.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { uploadAttachment } from '../../config/upload.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  listContactsSchema,
  threadSchema,
  markReadSchema,
  broadcastListSchema,
  sendDirectSchema,
  sendBroadcastSchema,
  editMessageSchema,
  deleteMessageSchema,
  forwardMessageSchema,
  registerDeviceSchema,
  removeDeviceSchema,
} from './chat.validation.js';

const router = Router();

// Every chat route requires a signed-in user.
router.use(authenticate);

// Discovery + summaries
router.get('/contacts', validate(listContactsSchema), chatController.contacts);
router.get('/conversations', chatController.conversations);
router.get('/unread', chatController.unread);

// Direct (one-to-one) messages
router.get('/messages/:userId', validate(threadSchema), chatController.thread);
router.post('/messages', validate(sendDirectSchema), chatController.sendDirect);
router.post('/messages/:userId/read', validate(markReadSchema), chatController.markRead);

// Edit / delete / forward a single message (by message id).
router.patch('/message/:id', validate(editMessageSchema), chatController.editMessage);
router.delete('/message/:id', validate(deleteMessageSchema), chatController.deleteMessage);
router.post(
  '/message/:id/forward',
  validate(forwardMessageSchema),
  chatController.forwardMessage,
);

// Broadcast channel — anyone can read, only admins can post.
router.get('/broadcast', validate(broadcastListSchema), chatController.broadcast);
router.post(
  '/broadcast',
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(sendBroadcastSchema),
  chatController.sendBroadcast,
);

// File/document upload — returns attachment metadata to attach to a message.
// Wrap multer so its size/type errors become clean ApiErrors.
router.post('/upload', (req, res, next) => {
  uploadAttachment(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('File is too large (max 15 MB)'));
      }
      return next(err.isOperational ? err : ApiError.badRequest(err.message));
    }
    return chatController.upload(req, res, next);
  });
});

// Push-notification device registration
router.post('/devices', validate(registerDeviceSchema), chatController.registerDevice);
router.delete('/devices', validate(removeDeviceSchema), chatController.removeDevice);

export default router;
