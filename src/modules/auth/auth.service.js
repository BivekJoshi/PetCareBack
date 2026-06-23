import { randomInt } from 'crypto';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { env, exposeDevOtp } from '../../config/env.js';
import { sendWhatsAppOtp } from '../../services/whatsapp.service.js';
import { sendOtpEmail } from '../../services/mail.service.js';
import { settingsService } from '../admin/settings.service.js';

// Fields safe to return to the client.
const publicUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  phoneVerified: true,
  emailVerified: true,
  role: true,
  isActive: true,
  createdAt: true,
};

const MAX_OTP_ATTEMPTS = 5;

const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

// Verification channels share one OTP engine; only these bits differ per channel.
const OTP_CHANNELS = {
  email: {
    label: 'Email',
    delegate: prisma.emailOtp,
    verifiedField: 'emailVerified',
    target: (u) => u.email,
    isEnabled: () => settingsService.isEmailOtpEnabled(),
    send: (to, code, u) => sendOtpEmail(to, code, { firstName: u.firstName }),
    devExposed: () => exposeDevOtp.email,
  },
  phone: {
    label: 'Phone',
    delegate: prisma.phoneOtp,
    verifiedField: 'phoneVerified',
    target: (u) => u.phone,
    isEnabled: () => settingsService.isOtpEnabled(),
    send: (to, code) => sendWhatsAppOtp(to, code),
    devExposed: () => exposeDevOtp.phone,
  },
};

const buildTokens = (user) => {
  const payload = { sub: user.id, role: user.role, email: user.email };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ sub: user.id }),
  };
};

// Auth response shaped for the PetCare frontend (expects tokenId + userType).
const authPayload = (user, tokens) => ({
  token: tokens.accessToken,
  tokenId: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  userType: user.role,
  user,
});

export const authService = {
  async register(input) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: input.role || 'PET_OWNER',
      },
      select: publicUser,
    });

    const tokens = buildTokens(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    // Kick off verification for each channel a super admin has enabled. When a
    // channel is off, no code is sent and none is required (the client skips
    // it). Best-effort: registration still succeeds if delivery fails.
    const verification = {};
    for (const channel of Object.keys(OTP_CHANNELS)) {
      const ch = OTP_CHANNELS[channel];
      const enabled = await ch.isEnabled();
      const target = ch.target(user);
      if (!enabled || !target) {
        verification[channel] = { required: Boolean(enabled), sent: false };
        continue;
      }
      try {
        verification[channel] = { required: true, ...(await this.issueOtp(channel, user.id)) };
      } catch (err) {
        verification[channel] = { required: true, sent: false, error: err.message };
      }
    }

    return { ...authPayload(user, tokens), verification };
  },

  /**
   * Generate a fresh OTP for `channel`, store its hash with a TTL, and deliver
   * it (email or WhatsApp). Enforces a per-user resend cooldown. Returns
   * delivery info (and, in dev with no real sender, the code itself).
   */
  async issueOtp(channel, userId) {
    const ch = OTP_CHANNELS[channel];
    if (!ch) throw ApiError.badRequest('Unknown verification channel');
    if (!(await ch.isEnabled())) {
      throw ApiError.badRequest(`${ch.label} verification is currently disabled`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, phone: true, phoneVerified: true, emailVerified: true },
    });
    if (!user) throw ApiError.notFound('User not found');
    if (user[ch.verifiedField]) throw ApiError.badRequest(`${ch.label} already verified`);

    const target = ch.target(user);
    if (!target) throw ApiError.badRequest(`No ${channel} on file to verify`);

    // Resend cooldown — block rapid re-sends.
    const existing = await ch.delegate.findUnique({ where: { userId } });
    if (existing) {
      const elapsedSec = (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
      const wait = Math.ceil(env.whatsapp.resendCooldownSec - elapsedSec);
      if (wait > 0) {
        throw ApiError.tooManyRequests(`Please wait ${wait}s before requesting another code`);
      }
    }

    const code = generateOtp();
    const codeHash = await hashPassword(code);
    const expiresAt = new Date(Date.now() + env.whatsapp.otpTtlMinutes * 60_000);

    await ch.delegate.upsert({
      where: { userId },
      create: { userId, codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
      update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
    });

    await ch.send(target, code, user);

    return {
      sent: true,
      channel,
      destination: target,
      expiresAt,
      // Only present in dev when this channel has no real sender configured.
      ...(ch.devExposed() ? { devCode: code } : {}),
    };
  },

  /**
   * Verify a submitted OTP for `channel`. On success marks the matching field
   * verified and clears the pending code. Wrong codes count toward a cap.
   */
  async verifyOtp(channel, userId, code) {
    const ch = OTP_CHANNELS[channel];
    if (!ch) throw ApiError.badRequest('Unknown verification channel');

    const record = await ch.delegate.findUnique({ where: { userId } });
    if (!record) throw ApiError.badRequest('No verification in progress. Request a new code.');

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await ch.delegate.delete({ where: { userId } }).catch(() => {});
      throw ApiError.badRequest('Code has expired. Request a new one.');
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await ch.delegate.delete({ where: { userId } }).catch(() => {});
      throw ApiError.tooManyRequests('Too many incorrect attempts. Request a new code.');
    }

    const ok = await comparePassword(code, record.codeHash);
    if (!ok) {
      await ch.delegate.update({ where: { userId }, data: { attempts: { increment: 1 } } });
      throw ApiError.badRequest('Incorrect code');
    }

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { [ch.verifiedField]: true },
        select: publicUser,
      }),
      ch.delegate.delete({ where: { userId } }),
    ]);
    return user;
  },

  async login({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

    const ok = await comparePassword(password, user.password);
    if (!ok) throw ApiError.unauthorized('Invalid email or password');

    const tokens = buildTokens(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    const { password: _pw, refreshToken: _rt, ...safe } = user;
    return authPayload(safe, tokens);
  },

  async refresh(refreshToken) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || user.refreshToken !== refreshToken) {
      throw ApiError.unauthorized('Refresh token has been revoked');
    }

    const tokens = buildTokens(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    const { password: _pw, refreshToken: _rt, ...safe } = user;
    return authPayload(safe, tokens);
  },

  async logout(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  },

  async me(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUser,
    });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  /** Public auth-related config the client needs before/independent of login. */
  async publicConfig() {
    const settings = await settingsService.getAuthSettings();
    return {
      otpEnabled: settings.otpEnabled,
      emailOtpEnabled: settings.emailOtpEnabled,
    };
  },
};
