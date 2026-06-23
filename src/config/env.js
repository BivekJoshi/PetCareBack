import dotenv from 'dotenv';

dotenv.config();

const required = (key) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT || 8081),

  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    refreshSecret: required('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),

  // Firebase Cloud Messaging (server-side push). Entirely optional — when any
  // of these is missing, push delivery is skipped and the app falls back to
  // real-time socket + in-app/system notifications only.
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    // Private keys in env files keep their newlines escaped as "\n".
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },

  // WhatsApp OTP delivery. Optional, like Firebase — when unconfigured the OTP
  // is logged to the server console (and surfaced in dev) so the verification
  // flow is fully testable without a provider. Set provider creds to go live.
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || '', // 'meta' | 'twilio'
    // Meta WhatsApp Cloud API
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    // Twilio
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: process.env.TWILIO_WHATSAPP_FROM || '',
    otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES || 10),
    resendCooldownSec: Number(process.env.OTP_RESEND_COOLDOWN_SEC || 30),
  },
};

// True only when every credential needed to talk to FCM is present.
export const isFirebaseConfigured = Boolean(
  env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey,
);

// True when a real WhatsApp provider is wired up; otherwise we run the dev stub.
export const isWhatsAppConfigured = Boolean(
  (env.whatsapp.provider === 'meta' && env.whatsapp.token && env.whatsapp.phoneNumberId) ||
    (env.whatsapp.provider === 'twilio' &&
      env.whatsapp.twilioAccountSid &&
      env.whatsapp.twilioAuthToken &&
      env.whatsapp.twilioFrom),
);

// In dev (no provider) the API echoes the OTP back so the client can show it
// for testing. Never enabled once a real provider is configured or in prod.
export const exposeDevOtp = !isWhatsAppConfigured && !env.isProd;
