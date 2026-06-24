import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { roleRequestService } from './role-request.service.js';

// Turn multer's uploaded files into the { url, name, type, size } document
// objects we store on the request (same URL scheme as chat attachments).
const mapDocuments = (req) =>
  (req.files || []).map((file) => ({
    url: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
    name: file.originalname,
    type: file.mimetype,
    size: file.size,
  }));

export const roleRequestController = {
  // ── User-facing ──
  create: asyncHandler(async (req, res) => {
    const data = await roleRequestService.create(req.user.id, {
      requestedRole: req.body.requestedRole,
      reason: req.body.reason,
      documents: mapDocuments(req),
    });
    sendSuccess(res, { statusCode: 201, message: 'Role request submitted', data });
  }),

  listMine: asyncHandler(async (req, res) => {
    const data = await roleRequestService.listMine(req.user.id);
    sendSuccess(res, { message: 'Your role requests', data });
  }),

  cancelMine: asyncHandler(async (req, res) => {
    const data = await roleRequestService.cancelMine(req.user.id, req.params.id);
    sendSuccess(res, { message: 'Role request cancelled', data });
  }),

  // ── Admin-facing ──
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await roleRequestService.listAll(req.query);
    sendSuccess(res, { message: 'Role requests fetched', data: { items, meta } });
  }),

  pendingCount: asyncHandler(async (_req, res) => {
    const count = await roleRequestService.pendingCount();
    sendSuccess(res, { message: 'Pending role requests', data: { count } });
  }),

  getById: asyncHandler(async (req, res) => {
    const data = await roleRequestService.getById(req.params.id);
    sendSuccess(res, { message: 'Role request fetched', data });
  }),

  review: asyncHandler(async (req, res) => {
    const data = await roleRequestService.review(req.params.id, req.user.id, req.body);
    sendSuccess(res, { message: 'Role request reviewed', data });
  }),
};
