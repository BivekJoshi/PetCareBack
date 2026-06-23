import { env, isFirebaseConfigured } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

// firebase-admin is loaded lazily so the server starts fine even when push is
// not configured (or the package isn't installed in a given environment).
let messaging = null;
let initTried = false;

const getMessaging = async () => {
  if (messaging || initTried) return messaging;
  initTried = true;

  if (!isFirebaseConfigured) {
    logger.info('Firebase not configured — push notifications disabled');
    return null;
  }

  try {
    const admin = (await import('firebase-admin')).default;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.firebase.projectId,
          clientEmail: env.firebase.clientEmail,
          privateKey: env.firebase.privateKey,
        }),
      });
    }
    messaging = admin.messaging();
    logger.info('Firebase Admin initialised — push notifications enabled');
  } catch (err) {
    logger.error('Failed to initialise Firebase Admin; push disabled', err);
    messaging = null;
  }

  return messaging;
};

/**
 * Send a push notification to every registered device of a user. No-ops
 * silently when push isn't configured. Stale tokens (unregistered devices)
 * are pruned automatically.
 *
 * @param {string} userId
 * @param {{ title: string, body: string, data?: Record<string,string> }} payload
 */
export const sendPushToUser = async (userId, { title, body, data = {} }) => {
  const fcm = await getMessaging();
  if (!fcm) return;

  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });
  if (tokens.length === 0) return;

  // All data values must be strings for FCM.
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)]),
  );

  try {
    const res = await fcm.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
      data: stringData,
      webpush: {
        notification: { title, body, icon: '/vite.svg' },
      },
    });

    // Remove tokens FCM reports as permanently invalid.
    const stale = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        stale.push(tokens[i].token);
      }
    });
    if (stale.length) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: stale } } });
    }
  } catch (err) {
    logger.error('Push send failed', err);
  }
};

/**
 * Fan a broadcast push out to every user that has a registered device,
 * excluding the author. Best-effort; failures are logged, never thrown.
 */
export const sendPushBroadcast = async (senderId, payload) => {
  const fcm = await getMessaging();
  if (!fcm) return;

  const rows = await prisma.deviceToken.findMany({
    where: { userId: { not: senderId } },
    distinct: ['userId'],
    select: { userId: true },
  });
  await Promise.all(rows.map((r) => sendPushToUser(r.userId, payload)));
};
