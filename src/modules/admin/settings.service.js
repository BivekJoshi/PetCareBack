import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { UPLOAD_DIR } from '../../config/upload.js';
import { logger } from '../../utils/logger.js';

const SINGLETON_ID = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

// Auth-settings singleton projection (never leak the editor's full row).
const authSettingSelect = {
  id: true,
  otpEnabled: true,
  emailOtpEnabled: true,
  updatedAt: true,
  updatedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
};

// Only ever expose the admin's name/email on the policy — never their full row.
const settingSelect = {
  id: true,
  retentionDays: true,
  enabled: true,
  lastPurgeAt: true,
  lastPurgeCount: true,
  updatedAt: true,
  updatedBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
};

// Resolve a stored attachment URL (full URL or "/uploads/<file>") to the on-disk
// path inside UPLOAD_DIR. Returns null if it points anywhere else (defensive —
// we never want a purge to unlink files outside the uploads directory).
const attachmentDiskPath = (attachmentUrl) => {
  if (!attachmentUrl) return null;
  const filename = path.basename(attachmentUrl.split('?')[0]);
  if (!filename || filename === '.' || filename === '..') return null;
  const resolved = path.resolve(UPLOAD_DIR, filename);
  if (path.dirname(resolved) !== path.resolve(UPLOAD_DIR)) return null;
  return resolved;
};

export const settingsService = {
  /** Read the singleton auth settings, creating it (OTP enabled) on first touch. */
  async getAuthSettings() {
    return prisma.authSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
      select: authSettingSelect,
    });
  },

  /** True when WhatsApp phone-OTP verification is currently enabled. */
  async isOtpEnabled() {
    const setting = await this.getAuthSettings();
    return setting.otpEnabled;
  },

  /** True when email-OTP verification is currently enabled. */
  async isEmailOtpEnabled() {
    const setting = await this.getAuthSettings();
    return setting.emailOtpEnabled;
  },

  /** Update auth settings (the OTP master switches) and record who changed it. */
  async updateAuthSettings(updates, adminId) {
    const data = { updatedById: adminId };
    if (updates.otpEnabled !== undefined) data.otpEnabled = updates.otpEnabled;
    if (updates.emailOtpEnabled !== undefined) data.emailOtpEnabled = updates.emailOtpEnabled;
    return prisma.authSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
      select: authSettingSelect,
    });
  },

  /**
   * Read the singleton chat-retention policy, creating it with defaults
   * (50 days, enabled) the first time it is touched.
   */
  async getRetention() {
    return prisma.messageRetentionSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
      select: settingSelect,
    });
  },

  /** Update the policy (days and/or on-off switch) and record who changed it. */
  async updateRetention(updates, adminId) {
    const data = { updatedById: adminId };
    if (updates.retentionDays !== undefined) data.retentionDays = updates.retentionDays;
    if (updates.enabled !== undefined) data.enabled = updates.enabled;

    return prisma.messageRetentionSetting.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
      select: settingSelect,
    });
  },

  /**
   * Permanently delete every message older than the configured window —
   * straight from the database — and remove their attachment files from disk.
   * Shared by the scheduled job and the admin's "Purge now" button.
   *
   * Returns { skipped, enabled, retentionDays, cutoff, deleted }.
   */
  async purgeOldMessages() {
    const setting = await this.getRetention();

    if (!setting.enabled) {
      logger.debug('Chat retention purge skipped — policy disabled');
      return { skipped: true, enabled: false, retentionDays: setting.retentionDays };
    }

    const cutoff = new Date(Date.now() - setting.retentionDays * DAY_MS);

    // Grab attachment URLs first so we can unlink the files after the DB delete.
    const withFiles = await prisma.message.findMany({
      where: { createdAt: { lt: cutoff }, attachmentUrl: { not: null } },
      select: { attachmentUrl: true },
    });

    // The actual permanent deletion. MessageHide rows cascade; newer replies
    // pointing at a purged message have their replyToId set to null.
    const { count } = await prisma.message.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    // Best-effort attachment cleanup — a missing file must never fail the purge.
    let filesRemoved = 0;
    await Promise.all(
      withFiles.map(async ({ attachmentUrl }) => {
        const diskPath = attachmentDiskPath(attachmentUrl);
        if (!diskPath) return;
        try {
          await fs.unlink(diskPath);
          filesRemoved += 1;
        } catch (err) {
          if (err.code !== 'ENOENT') {
            logger.warn(`Failed to unlink purged attachment ${diskPath}:`, err.message);
          }
        }
      }),
    );

    await prisma.messageRetentionSetting.update({
      where: { id: SINGLETON_ID },
      data: { lastPurgeAt: new Date(), lastPurgeCount: count },
    });

    if (count > 0) {
      logger.info(
        `Chat retention purge: deleted ${count} message(s) older than ` +
          `${setting.retentionDays}d (before ${cutoff.toISOString()}), ` +
          `removed ${filesRemoved} attachment file(s)`,
      );
    }

    return {
      skipped: false,
      enabled: true,
      retentionDays: setting.retentionDays,
      cutoff,
      deleted: count,
      filesRemoved,
    };
  },
};
