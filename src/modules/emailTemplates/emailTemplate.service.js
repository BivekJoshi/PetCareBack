import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import { EMAIL_TEMPLATE_DEFAULTS } from '../../templates/emailDefaults.js';

/**
 * Email templating. Each template's editable content (subject + HTML "UI") lives
 * in the DB, managed from the admin Control Panel. The mailer renders by key,
 * filling {{tokens}} with the per-send values. When a key has no DB row yet (or
 * the frontend hasn't seeded), the bundled default (emailDefaults.js) is used —
 * so transactional email always works, even before anything is configured.
 */

// Only ever expose the editor's name/email on a template — never their full row.
const templateSelect = {
  key: true,
  name: true,
  subject: true,
  html: true,
  updatedAt: true,
  updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
};

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const greeting = (firstName, escape) => {
  if (!firstName) return 'Hello,';
  return `Hi ${escape ? escapeHtml(firstName) : firstName},`;
};

// Token sets per output: HTML escapes dynamic strings; text/subject use raw values.
const htmlTokens = (d) => ({
  greeting: greeting(d.firstName, true),
  code: String(d.code),
  spacedCode: String(d.code).split('').join('&nbsp;&nbsp;'),
  ttlMinutes: String(d.ttlMinutes),
});
const textTokens = (d) => ({
  greeting: greeting(d.firstName, false),
  code: String(d.code),
  spacedCode: String(d.code).split('').join(' '),
  ttlMinutes: String(d.ttlMinutes),
});
const subjectTokens = (d) => ({ code: String(d.code), ttlMinutes: String(d.ttlMinutes) });

const fill = (str, tokens) =>
  String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match,
  );

const requireDefault = (key) => {
  const def = EMAIL_TEMPLATE_DEFAULTS[key];
  if (!def) throw ApiError.notFound(`Unknown email template: ${key}`);
  return def;
};

// Merge a (possibly absent) DB row with its default — the shape the UI/mailer use.
const merge = (def, row) => ({
  key: def.key,
  name: row?.name || def.name,
  description: def.description,
  subject: row?.subject ?? def.subject,
  html: row?.html ?? def.html,
  tokens: def.tokens,
  isDefault: !row,
  updatedAt: row?.updatedAt || null,
  updatedBy: row?.updatedBy || null,
});

export const emailTemplateService = {
  /**
   * Render a template by key into { subject, html, text } for nodemailer.
   * `data` carries the values to fill: { code, firstName?, ttlMinutes? }.
   */
  async render(key, data) {
    const def = requireDefault(key);
    const filled = {
      code: data.code ?? '',
      firstName: data.firstName,
      ttlMinutes: data.ttlMinutes ?? env.whatsapp.otpTtlMinutes,
    };

    let row = null;
    try {
      row = await prisma.emailTemplate.findUnique({ where: { key } });
    } catch (err) {
      // Never let a DB hiccup block email — fall back to the bundled default.
      logger.warn(`Email template "${key}" lookup failed (${err.message}); using default`);
    }

    return {
      subject: fill(row?.subject || def.subject, subjectTokens(filled)),
      html: fill(row?.html || def.html, htmlTokens(filled)),
      text: fill(def.text, textTokens(filled)),
    };
  },

  /** List every template (DB row merged with its default), for the admin editor. */
  async list() {
    const rows = await prisma.emailTemplate.findMany({ select: templateSelect });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    return Object.values(EMAIL_TEMPLATE_DEFAULTS).map((def) => merge(def, byKey[def.key]));
  },

  /** Get a single template (DB row merged with its default). */
  async get(key) {
    const def = requireDefault(key);
    const row = await prisma.emailTemplate.findUnique({ where: { key }, select: templateSelect });
    return merge(def, row);
  },

  /** Save edits to a template's subject + HTML, recording who changed it. */
  async update(key, { subject, html }, adminId) {
    const def = requireDefault(key);
    const row = await prisma.emailTemplate.upsert({
      where: { key },
      create: { key, name: def.name, subject, html, updatedById: adminId },
      update: { subject, html, updatedById: adminId },
      select: templateSelect,
    });
    return merge(def, row);
  },

  /** Restore a template's subject + HTML to the bundled default. */
  async reset(key, adminId) {
    const def = requireDefault(key);
    const row = await prisma.emailTemplate.upsert({
      where: { key },
      create: { key, name: def.name, subject: def.subject, html: def.html, updatedById: adminId },
      update: { subject: def.subject, html: def.html, updatedById: adminId },
      select: templateSelect,
    });
    return merge(def, row);
  },

  /** Seed any missing template rows from the defaults (idempotent). */
  async seedDefaults() {
    for (const def of Object.values(EMAIL_TEMPLATE_DEFAULTS)) {
      await prisma.emailTemplate.upsert({
        where: { key: def.key },
        create: { key: def.key, name: def.name, subject: def.subject, html: def.html },
        update: {}, // never clobber admin edits on re-seed
      });
    }
  },
};

// Back-compat helper used by the mail service.
export const renderEmailTemplate = (key, data) => emailTemplateService.render(key, data);
