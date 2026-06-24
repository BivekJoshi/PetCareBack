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
import { sendWhatsAppOtp } from '../../integrations/whatsapp.service.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../../integrations/mail.service.js';
import { verifyGoogleAccessToken } from '../../integrations/google.service.js';
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
  avatarUrl: true,
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

    // Just registered with a password, so it's set.
    return { ...authPayload({ ...user, hasPassword: true }, tokens), verification };
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
    // OAuth-only accounts have no password — steer them to their provider.
    if (!user.password) throw ApiError.unauthorized('Use "Sign in with Google" for this account');

    const lockout = await settingsService.getLockoutPolicy();

    // Already locked out? Block until the window passes.
    if (lockout.enabled && user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60_000);
      throw ApiError.tooManyRequests(
        `Account locked due to too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      );
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      // Count the failure and, once the cap is hit, lock the account for a while.
      if (lockout.enabled) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        if (attempts >= lockout.maxAttempts) {
          const lockedUntil = new Date(Date.now() + lockout.durationMinutes * 60_000);
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil },
          });
          throw ApiError.tooManyRequests(
            `Too many failed attempts. Account locked for ${lockout.durationMinutes} minute${lockout.durationMinutes === 1 ? '' : 's'}.`,
          );
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: attempts },
        });
        const left = lockout.maxAttempts - attempts;
        throw ApiError.unauthorized(
          `Invalid email or password. ${left} attempt${left === 1 ? '' : 's'} left before your account is locked.`,
        );
      }
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Success — clear any failure count / lock and issue a session.
    const tokens = buildTokens(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken, failedLoginAttempts: 0, lockedUntil: null },
    });

    const { password: _pw, refreshToken: _rt, ...safe } = user;
    return authPayload({ ...safe, hasPassword: Boolean(_pw) }, tokens);
  },

  /**
   * Sign in (or sign up) with Google. Validates the client-obtained access token
   * with Google, then resolves the account: an existing Google-linked user, or
   * an existing email match (which gets linked to Google), or a brand-new
   * account. OAuth accounts have no password and may have no phone yet — the
   * response's `needsPhone` flag tells the client to collect one afterwards.
   */
  async googleAuth(accessToken) {
    const profile = await verifyGoogleAccessToken(accessToken);

    // Prefer an existing Google link; fall back to matching the verified email.
    let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (!user) user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (user) {
      if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');
      // Backfill the Google link / verified-email / avatar on first connect.
      const patch = {};
      if (!user.googleId) patch.googleId = profile.googleId;
      if (profile.emailVerified && !user.emailVerified) patch.emailVerified = true;
      if (profile.avatarUrl && !user.avatarUrl) patch.avatarUrl = profile.avatarUrl;
      if (Object.keys(patch).length) {
        user = await prisma.user.update({ where: { id: user.id }, data: patch });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName || 'Pet',
          lastName: profile.lastName || 'Owner',
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl,
          emailVerified: profile.emailVerified,
          role: 'PET_OWNER',
        },
      });
    }

    const tokens = buildTokens(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    const safe = await prisma.user.findUnique({ where: { id: user.id }, select: publicUser });
    // OAuth accounts start with no password; the client offers to add one (and a
    // phone) after sign-in. `hasPassword` lets it show "add" vs "change".
    const enriched = { ...safe, hasPassword: Boolean(user.password) };
    return { ...authPayload(enriched, tokens), needsPhone: !safe.phone };
  },

  /**
   * Attach (or change) a user's phone number — used right after Google sign-in
   * when no phone is on file. Resets phone verification and, when WhatsApp OTP is
   * enabled, immediately sends a code so the client can verify it.
   */
  async setPhone(userId, phone) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: false },
      select: publicUser,
    });

    const enabled = await settingsService.isOtpEnabled();
    let phoneVerification = { required: Boolean(enabled), sent: false };
    if (enabled) {
      try {
        phoneVerification = { required: true, ...(await this.issueOtp('phone', userId)) };
      } catch (err) {
        phoneVerification = { required: true, sent: false, error: err.message };
      }
    }

    return { user, verification: { phone: phoneVerification } };
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
    return authPayload({ ...safe, hasPassword: Boolean(_pw) }, tokens);
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
      select: { ...publicUser, password: true },
    });
    if (!user) throw ApiError.notFound('User not found');
    const { password, ...safe } = user;
    return { ...safe, hasPassword: Boolean(password) };
  },

  // Set the signed-in user's profile photo to a freshly uploaded image URL.
  async updateAvatar(userId, avatarUrl) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { ...publicUser, password: true },
    });
    const { password, ...safe } = user;
    return { ...safe, hasPassword: Boolean(password) };
  },

  /**
   * Add a password to an account that has none yet — typically a Google sign-in
   * user who wants the option of signing in with email + password too. Refuses
   * if a password already exists (use `changePassword` for that).
   */
  async setPassword(userId, password) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');
    if (user.password) {
      throw ApiError.badRequest('You already have a password — use change password instead');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(password) },
      select: publicUser,
    });
    return { user: { ...updated, hasPassword: true } };
  },

  /**
   * Change an existing password. Requires the current password and rejects a
   * new password identical to the old one.
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');
    if (!user.password) {
      throw ApiError.badRequest('Your account has no password yet — set one first');
    }

    const ok = await comparePassword(currentPassword, user.password);
    if (!ok) throw ApiError.unauthorized('Your current password is incorrect');

    const reused = await comparePassword(newPassword, user.password);
    if (reused) throw ApiError.badRequest('New password must be different from your current one');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(newPassword) },
      select: publicUser,
    });
    return { user: { ...updated, hasPassword: true } };
  },

  /**
   * Start a "forgot password" reset for `email`: email a 6-digit code that the
   * user later exchanges (with a new password) via `resetPassword`. Always
   * resolves the same way regardless of whether the email exists, so the
   * endpoint can't be used to probe which addresses are registered.
   */
  async forgotPassword(email) {
    const generic = { sent: true };

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) return generic; // don't reveal whether the email exists

    // Honour a resend cooldown — but silently, so timing never leaks existence.
    const existing = await prisma.passwordResetOtp.findUnique({ where: { userId: user.id } });
    if (existing) {
      const elapsedSec = (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
      if (elapsedSec < env.whatsapp.resendCooldownSec) return generic;
    }

    const code = generateOtp();
    const codeHash = await hashPassword(code);
    const expiresAt = new Date(Date.now() + env.whatsapp.otpTtlMinutes * 60_000);

    await prisma.passwordResetOtp.upsert({
      where: { userId: user.id },
      create: { userId: user.id, codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
      update: { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
    });

    // Best-effort delivery — a transient mail error shouldn't fail the request.
    try {
      await sendPasswordResetEmail(user.email, code, { firstName: user.firstName });
    } catch {
      /* swallow — the user can request another code */
    }

    // Only surfaced in dev when no real mailer is configured.
    return { ...generic, ...(exposeDevOtp.email ? { devCode: code } : {}) };
  },

  /**
   * Complete a reset: validate the emailed code and set the new password. Also
   * marks the email verified (ownership proven) and revokes existing sessions.
   * Wrong codes count toward the same attempt cap as other OTPs.
   */
  async resetPassword(email, code, password) {
    // One opaque error for every "no valid code" case — avoids leaking details.
    const invalid = () => ApiError.badRequest('Invalid or expired reset code');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw invalid();

    const record = await prisma.passwordResetOtp.findUnique({ where: { userId: user.id } });
    if (!record) throw invalid();

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await prisma.passwordResetOtp.delete({ where: { userId: user.id } }).catch(() => {});
      throw invalid();
    }
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.passwordResetOtp.delete({ where: { userId: user.id } }).catch(() => {});
      throw ApiError.tooManyRequests('Too many incorrect attempts. Request a new code.');
    }

    const ok = await comparePassword(code, record.codeHash);
    if (!ok) {
      await prisma.passwordResetOtp.update({
        where: { userId: user.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid();
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // Proven email ownership; clear any lockout and revoke existing sessions.
        data: {
          password: passwordHash,
          emailVerified: true,
          refreshToken: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetOtp.delete({ where: { userId: user.id } }),
    ]);

    return { reset: true };
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
