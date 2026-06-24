import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export const roleRequestFieldService = {
  /** List configured fields, optionally for one role / including inactive ones. */
  async list({ role, includeInactive } = {}) {
    return prisma.roleRequestField.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ role: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    });
  },

  /** Active fields for a role, in display order — used when building/validating the form. */
  async activeForRole(role) {
    return prisma.roleRequestField.findMany({
      where: { role, isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  },

  async create(input) {
    const exists = await prisma.roleRequestField.findUnique({
      where: { role_key: { role: input.role, key: input.key } },
    });
    if (exists) throw ApiError.conflict(`A "${input.key}" field already exists for ${input.role}`);

    return prisma.roleRequestField.create({
      data: {
        role: input.role,
        key: input.key,
        label: input.label,
        type: input.type,
        required: input.required,
        placeholder: input.placeholder,
        options: input.type === 'SELECT' ? input.options : [],
        order: input.order,
        isActive: input.isActive,
      },
    });
  },

  async update(id, data) {
    const field = await prisma.roleRequestField.findUnique({ where: { id } });
    if (!field) throw ApiError.notFound('Field not found');

    // If the resulting type is SELECT, ensure options exist (old or new).
    const nextType = data.type ?? field.type;
    const nextOptions = data.options ?? field.options;
    if (nextType === 'SELECT' && (!Array.isArray(nextOptions) || nextOptions.length === 0)) {
      throw ApiError.badRequest('Add at least one option for a dropdown');
    }

    return prisma.roleRequestField.update({
      where: { id },
      data: {
        ...data,
        // Non-select fields don't keep options around.
        ...(nextType !== 'SELECT' ? { options: [] } : {}),
      },
    });
  },

  async remove(id) {
    const field = await prisma.roleRequestField.findUnique({ where: { id } });
    if (!field) throw ApiError.notFound('Field not found');
    await prisma.roleRequestField.delete({ where: { id } });
  },

  /**
   * Validate an applicant's answers against the active fields for a role and
   * return a stable snapshot ([{ key, label, type, value }]) to store on the
   * request. Throws ApiError if a required field is missing or a SELECT value
   * isn't one of the allowed options.
   */
  async buildSnapshot(role, answers = {}) {
    const fields = await this.activeForRole(role);
    const snapshot = [];

    for (const field of fields) {
      const raw = answers[field.key];
      const value = raw == null ? '' : String(raw).trim();

      if (!value) {
        if (field.required) throw ApiError.badRequest(`${field.label} is required`);
        continue; // optional & empty → skip
      }

      if (field.type === 'NUMBER' && Number.isNaN(Number(value))) {
        throw ApiError.badRequest(`${field.label} must be a number`);
      }
      if (field.type === 'SELECT') {
        const options = Array.isArray(field.options) ? field.options : [];
        if (!options.includes(value)) {
          throw ApiError.badRequest(`${field.label} must be one of: ${options.join(', ')}`);
        }
      }

      snapshot.push({ key: field.key, label: field.label, type: field.type, value });
    }

    return snapshot;
  },
};
