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
import { settingsService } from '../admin/settings.service.js';

// Fields safe to return to the client.
const publicUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  phoneVerified: true,
  role: true,
  isActive: true,
  createdAt: true,
};

const MAX_OTP_ATTEMPTS = 5;

const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

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

    // Kick off WhatsApp phone verification — but only if a super admin has it
    // enabled. When disabled, no OTP is sent and none is required (the client
    // skips the verification step entirely). Best-effort: registration still
    // succeeds (account is just "unverified") if delivery fails.
    const otpEnabled = await settingsService.isOtpEnabled();
    let otp = { required: otpEnabled, sent: false };
    if (otpEnabled && user.phone) {
      try {
        otp = { required: true, ...(await this.issuePhoneOtp(user.id, user.phone)) };
      } catch (err) {
        otp = { required: true, sent: false, error: err.message };
      }
    }

    return { ...authPayload(user, tokens), otp };
  },

  /**
   * Generate a fresh OTP for a user, store its hash with a TTL, and deliver it
   * over WhatsApp. Enforces a per-user resend cooldown. Returns delivery info
   * (and, in dev with no provider, the code itself so the UI can show it).
   */
  async issuePhoneOtp(userId, phoneArg) {
    if (!(await settingsService.isOtpEnabled())) {
      throw ApiError.badRequest('Phone verification is currently disabled');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, phoneVerified: true },
    });
    if (!user) throw ApiError.notFound('User not found');
    if (user.phoneVerified) throw ApiError.badRequest('Phone number already verified');

    const phone = phoneArg || user.phone;
    if (!phone) throw ApiError.badRequest('No phone number on file to verify');

    // Resend cooldown — block rapid re-sends.
    const existing = await prisma.phoneOtp.findUnique({ where: { userId } });
    if (existing) {
      const elapsedSec = (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
      const wait = Math.ceil(env.whatsapp.resendCooldownSec - elapsedSec);
      if (wait > 0) {
        throw ApiError.tooManyRequests(
          `Please wait ${wait}s before requesting another code`,
        );
      }
    }

    const code = generateOtp();
    const codeHash = await hashPassword(code);
    const expiresAt = new Date(Date.now() + env.whatsapp.otpTtlMinutes * 60_000);

    await prisma.phoneOtp.upsert({
      where: { userId },
      create: { userId, codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
      update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
    });

    await sendWhatsAppOtp(phone, code);

    return {
      sent: true,
      phone,
      expiresAt,
      // Only present in dev when no real provider is wired up.
      ...(exposeDevOtp ? { devCode: code } : {}),
    };
  },

  /**
   * Verify a submitted OTP. On success marks the phone verified and clears the
   * pending code. Wrong codes count toward an attempt cap.
   */
  async verifyPhoneOtp(userId, code) {
    const record = await prisma.phoneOtp.findUnique({ where: { userId } });
    if (!record) throw ApiError.badRequest('No verification in progress. Request a new code.');

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await prisma.phoneOtp.delete({ where: { userId } }).catch(() => {});
      throw ApiError.badRequest('Code has expired. Request a new one.');
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.phoneOtp.delete({ where: { userId } }).catch(() => {});
      throw ApiError.tooManyRequests('Too many incorrect attempts. Request a new code.');
    }

    const ok = await comparePassword(code, record.codeHash);
    if (!ok) {
      await prisma.phoneOtp.update({
        where: { userId },
        data: { attempts: { increment: 1 } },
      });
      throw ApiError.badRequest('Incorrect code');
    }

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { phoneVerified: true },
        select: publicUser,
      }),
      prisma.phoneOtp.delete({ where: { userId } }),
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
    return { otpEnabled: await settingsService.isOtpEnabled() };
  },
};
