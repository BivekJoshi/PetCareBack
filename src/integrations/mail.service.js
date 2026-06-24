import nodemailer from 'nodemailer';
import { env, isMailConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { renderEmailTemplate } from '../modules/emailTemplates/emailTemplate.service.js';

// Lazily-created transport so the server boots fine when mail is unconfigured.
let transport = null;
const getTransport = () => {
  if (transport) return transport;
  if (!isMailConfigured) return null;
  transport = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    // 465 = implicit TLS; Mailtrap sandbox (2525/587) uses STARTTLS.
    secure: env.mail.port === 465,
    auth: { user: env.mail.user, pass: env.mail.pass },
  });
  return transport;
};

/**
 * Send the sign-up OTP email. When SMTP isn't configured (dev), the code is
 * logged instead of sent so the flow still works. Returns true when handed to
 * the mail server.
 */
export const sendOtpEmail = async (to, code, { firstName } = {}) => {
  const { subject, html, text } = await renderEmailTemplate('otp', { code, firstName });

  const tx = getTransport();
  if (!tx) {
    logger.info(`[Email OTP · dev] → ${to}: ${code}`);
    return false;
  }

  await tx.sendMail({ from: env.mail.from, to, subject, html, text });
  logger.info(`Email OTP sent to ${to}`);
  return true;
};

/**
 * Send a password-reset code email. Like sendOtpEmail, falls back to logging the
 * code in dev when SMTP isn't configured. Returns true when handed to the server.
 */
export const sendPasswordResetEmail = async (to, code, { firstName } = {}) => {
  const { subject, html, text } = await renderEmailTemplate('password-reset', { code, firstName });

  const tx = getTransport();
  if (!tx) {
    logger.info(`[Password reset · dev] → ${to}: ${code}`);
    return false;
  }

  await tx.sendMail({ from: env.mail.from, to, subject, html, text });
  logger.info(`Password reset code sent to ${to}`);
  return true;
};

// Title-case a Role enum for display: "PET_OWNER" -> "Pet Owner".
const humanizeRole = (value = '') =>
  String(value)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const escapeHtml = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/**
 * Notify a user of an admin's decision on their role-change request. Unlike the
 * OTP mails this isn't an editable template — it's a one-off transactional note.
 * Falls back to logging in dev when SMTP isn't configured.
 */
export const sendRoleDecisionEmail = async (
  to,
  { firstName, status, grantedRole, requestedRole, adminNote } = {},
) => {
  const approved = status === 'APPROVED';
  const roleLabel = humanizeRole(grantedRole || requestedRole);
  const subject = approved
    ? 'Your PetCare role request was approved'
    : 'Update on your PetCare role request';

  const headline = approved
    ? `Good news — your request to become a <strong>${escapeHtml(roleLabel)}</strong> has been approved.`
    : `Your request to become a <strong>${escapeHtml(humanizeRole(requestedRole))}</strong> was not approved this time.`;

  const noteBlock = adminNote
    ? `<div style="margin:0 0 24px;padding:14px 16px;background:#f0fbfa;border:1px solid #cdeeed;border-radius:12px;font-size:14px;color:#475467;">
         <strong style="color:#101828;">Note from the team:</strong><br/>${escapeHtml(adminNote)}
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px -12px rgba(16,24,40,.25);">
        <tr><td style="background:linear-gradient(135deg,#0E9594,#0a6e6d);padding:28px 32px;">
          <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:.3px;">🐾 PetCare</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#101828;">${firstName ? `Hi ${escapeHtml(firstName)},` : 'Hello,'}</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475467;">${headline}</p>
          ${noteBlock}
          <p style="margin:0;font-size:13px;color:#98a2b3;">You can review the status anytime from your PetCare account.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eef0f2;">
          <p style="margin:0;font-size:12px;color:#98a2b3;">© PetCare · This is an automated message, please don't reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text =
    `${firstName ? `Hi ${firstName},` : 'Hello,'}\n\n` +
    (approved
      ? `Your request to become a ${roleLabel} has been approved.`
      : `Your request to become a ${humanizeRole(requestedRole)} was not approved this time.`) +
    (adminNote ? `\n\nNote from the team: ${adminNote}` : '') +
    '\n\n— The PetCare Team';

  const tx = getTransport();
  if (!tx) {
    logger.info(`[Role decision · dev] → ${to}: ${status} (${roleLabel})`);
    return false;
  }

  await tx.sendMail({ from: env.mail.from, to, subject, html, text });
  logger.info(`Role-decision email sent to ${to}`);
  return true;
};
