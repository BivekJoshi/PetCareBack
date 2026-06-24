import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { sendRoleDecisionEmail } from '../../integrations/mail.service.js';

// Shape returned to clients — never leak the requester's full user row.
const requesterSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
};

const requestSelect = {
  id: true,
  userId: true,
  currentRole: true,
  requestedRole: true,
  reason: true,
  documents: true,
  status: true,
  adminNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: requesterSelect },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
};

export const roleRequestService = {
  // ── User-facing ────────────────────────────────────────────────

  /** A user submits a new role-change request with optional documents. */
  async create(userId, { requestedRole, reason, documents = [] }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw ApiError.notFound('User not found');

    if (user.role === requestedRole) {
      throw ApiError.badRequest(`You already have the ${requestedRole} role`);
    }

    const pending = await prisma.roleChangeRequest.findFirst({
      where: { userId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw ApiError.conflict(
        'You already have a pending role request. Cancel it before submitting a new one.',
      );
    }

    return prisma.roleChangeRequest.create({
      data: {
        userId,
        currentRole: user.role,
        requestedRole,
        reason: reason || null,
        documents,
      },
      select: requestSelect,
    });
  },

  /** Every request the given user has submitted, newest first. */
  async listMine(userId) {
    return prisma.roleChangeRequest.findMany({
      where: { userId },
      select: requestSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Withdraw a still-pending request the user owns. */
  async cancelMine(userId, id) {
    const request = await prisma.roleChangeRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!request || request.userId !== userId) throw ApiError.notFound('Request not found');
    if (request.status !== 'PENDING') {
      throw ApiError.badRequest('Only a pending request can be cancelled');
    }
    return prisma.roleChangeRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: requestSelect,
    });
  },

  // ── Admin-facing ───────────────────────────────────────────────

  /** Paginated list of all requests, filterable by status and requester. */
  async listAll({ page, limit, status, search }) {
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total, pending] = await Promise.all([
      prisma.roleChangeRequest.findMany({
        where,
        select: requestSelect,
        skip: (page - 1) * limit,
        take: limit,
        // Pending first so admins see what needs action up top, then newest.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.roleChangeRequest.count({ where }),
      prisma.roleChangeRequest.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), pending },
    };
  },

  /** Count of requests still awaiting review (for the sidebar badge). */
  async pendingCount() {
    return prisma.roleChangeRequest.count({ where: { status: 'PENDING' } });
  },

  async getById(id) {
    const request = await prisma.roleChangeRequest.findUnique({
      where: { id },
      select: requestSelect,
    });
    if (!request) throw ApiError.notFound('Request not found');
    return request;
  },

  /**
   * Admin decision. Approving changes the requester's role (to the requested
   * role, or an admin-supplied override). The user's role and the request are
   * updated atomically; the user is then emailed the outcome (best-effort).
   */
  async review(id, adminId, { status, adminNote, overrideRole }) {
    const request = await prisma.roleChangeRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, requestedRole: true },
    });
    if (!request) throw ApiError.notFound('Request not found');
    if (request.status !== 'PENDING') {
      throw ApiError.badRequest('This request has already been reviewed');
    }

    const grantedRole = status === 'APPROVED' ? overrideRole || request.requestedRole : null;

    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'APPROVED') {
        await tx.user.update({ where: { id: request.userId }, data: { role: grantedRole } });
      }
      return tx.roleChangeRequest.update({
        where: { id },
        data: {
          status,
          adminNote: adminNote || null,
          reviewedById: adminId,
          reviewedAt: new Date(),
          // Record what the user was actually granted (override-aware).
          ...(status === 'APPROVED' ? { requestedRole: grantedRole } : {}),
        },
        select: requestSelect,
      });
    });

    // Notify the requester out-of-band; a mail failure must not fail the review.
    try {
      await sendRoleDecisionEmail(updated.user.email, {
        firstName: updated.user.firstName,
        status,
        grantedRole,
        requestedRole: request.requestedRole,
        adminNote: adminNote || null,
      });
    } catch (err) {
      logger.warn(`Role-decision email to ${updated.user.email} failed: ${err.message}`);
    }

    return updated;
  },
};
