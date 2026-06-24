import { Router } from 'express';
import { roleRequestController } from './role-request.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { uploadRoleDocuments } from '../../config/upload.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  idParam,
  createRoleRequestSchema,
  listRoleRequestsSchema,
  reviewRoleRequestSchema,
} from './role-request.validation.js';

const router = Router();

// Every route needs a signed-in user.
router.use(authenticate);

// Wrap multer so its size/type errors surface as clean ApiErrors (mirrors chat upload).
const acceptDocuments = (req, res, next) => {
  uploadRoleDocuments(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('A document is too large (max 15 MB each)'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(ApiError.badRequest('Too many documents (max 5)'));
      }
      return next(err.isOperational ? err : ApiError.badRequest(err.message));
    }
    return next();
  });
};

// ── User: submit and manage your own requests ──
router.post('/', acceptDocuments, validate(createRoleRequestSchema), roleRequestController.create);
router.get('/mine', roleRequestController.listMine);
router.post('/:id/cancel', validate(idParam), roleRequestController.cancelMine);

// ── Admin: review queue (literal routes before the /:id catch-all) ──
const adminOnly = authorize('ADMIN', 'SUPER_ADMIN');

router.get('/pending-count', adminOnly, roleRequestController.pendingCount);
router.get('/', adminOnly, validate(listRoleRequestsSchema), roleRequestController.list);
router.get('/:id', adminOnly, validate(idParam), roleRequestController.getById);
router.patch(
  '/:id/review',
  adminOnly,
  validate(reviewRoleRequestSchema),
  roleRequestController.review,
);

export default router;
