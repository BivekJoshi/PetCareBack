import { env, isGoogleConfigured } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

// Google endpoints. `tokeninfo` tells us which client the token was minted for
// (so we can reject tokens stolen from another app); `userinfo` returns the
// profile. Both are public, server-to-server, and need no client secret.
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const toBool = (v) => v === true || v === 'true';

/**
 * Validate a Google OAuth access token (obtained client-side via Google Identity
 * Services) and return the normalized profile. Throws if Google rejects the
 * token or it was not issued for this application's client ID.
 */
export const verifyGoogleAccessToken = async (accessToken) => {
  if (!isGoogleConfigured) {
    throw ApiError.badRequest('Google sign-in is not configured on the server');
  }

  // 1) Confirm the token belongs to THIS app — guards against a token minted for
  //    a different client being replayed against us (confused-deputy).
  let info;
  try {
    const res = await fetch(
      `${TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
    info = await res.json();
  } catch (err) {
    logger.warn(`Google tokeninfo failed: ${err.message}`);
    throw ApiError.unauthorized('Invalid or expired Google token');
  }

  const audience = info.aud || info.azp;
  if (audience !== env.google.clientId) {
    throw ApiError.unauthorized('Google token was not issued for this application');
  }

  // 2) Fetch the full profile (name + picture).
  let profile;
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`userinfo ${res.status}`);
    profile = await res.json();
  } catch (err) {
    logger.warn(`Google userinfo failed: ${err.message}`);
    throw ApiError.unauthorized('Could not read your Google profile');
  }

  if (!profile.email) throw ApiError.badRequest('Your Google account has no email address');

  return {
    googleId: profile.sub,
    email: String(profile.email).toLowerCase(),
    emailVerified: toBool(profile.email_verified),
    firstName: profile.given_name || '',
    lastName: profile.family_name || '',
    avatarUrl: profile.picture || null,
  };
};
