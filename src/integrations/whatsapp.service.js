import { env, isWhatsAppConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Normalise a phone number to bare international digits (no "+", spaces, dashes).
const digits = (phone) => String(phone || '').replace(/[^\d]/g, '');

const otpText = (code, ttlMin) =>
  `Your PetCare verification code is ${code}. It expires in ${ttlMin} minutes. ` +
  `Do not share this code with anyone.`;

// ── Real providers (only used when configured) ──────────────────────────────

const sendViaMeta = async (phone, text) => {
  const url = `https://graph.facebook.com/v19.0/${env.whatsapp.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsapp.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: digits(phone),
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) throw new Error(`Meta WhatsApp API ${res.status}: ${await res.text()}`);
};

const sendViaTwilio = async (phone, text) => {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.whatsapp.twilioAccountSid}/Messages.json`;
  const body = new URLSearchParams({
    From: `whatsapp:${env.whatsapp.twilioFrom}`,
    To: `whatsapp:+${digits(phone)}`,
    Body: text,
  });
  const auth = Buffer.from(
    `${env.whatsapp.twilioAccountSid}:${env.whatsapp.twilioAuthToken}`,
  ).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`Twilio WhatsApp API ${res.status}: ${await res.text()}`);
};

/**
 * Deliver an OTP over WhatsApp. When no provider is configured (dev), the code
 * is logged to the server console instead of being sent — the verification flow
 * still works end-to-end. Returns true when handed to a real provider.
 */
export const sendWhatsAppOtp = async (phone, code) => {
  const text = otpText(code, env.whatsapp.otpTtlMinutes);

  if (!isWhatsAppConfigured) {
    logger.info(`[WhatsApp OTP · dev] → ${phone}: ${code}`);
    return false;
  }

  if (env.whatsapp.provider === 'twilio') await sendViaTwilio(phone, text);
  else await sendViaMeta(phone, text);

  logger.info(`WhatsApp OTP sent to ${phone}`);
  return true;
};
