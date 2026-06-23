import nodemailer from 'nodemailer';
import { env, isMailConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { otpEmail } from '../templates/otpEmail.js';
import { passwordResetEmail } from '../templates/passwordResetEmail.js';

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
  const { subject, html, text } = otpEmail({
    code,
    firstName,
    ttlMinutes: env.whatsapp.otpTtlMinutes,
  });

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
  const { subject, html, text } = passwordResetEmail({
    code,
    firstName,
    ttlMinutes: env.whatsapp.otpTtlMinutes,
  });

  const tx = getTransport();
  if (!tx) {
    logger.info(`[Password reset · dev] → ${to}: ${code}`);
    return false;
  }

  await tx.sendMail({ from: env.mail.from, to, subject, html, text });
  logger.info(`Password reset code sent to ${to}`);
  return true;
};
