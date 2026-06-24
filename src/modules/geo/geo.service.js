import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';

// Only Google Maps hosts may be resolved server-side — this endpoint follows
// redirects and fetches the target, so restricting the host prevents it being
// abused as an open proxy / SSRF vector against internal services.
const isGoogleHost = (host) =>
  host === 'goo.gl' ||
  host === 'maps.app.goo.gl' ||
  host === 'g.co' ||
  host.endsWith('.google.com') ||
  host === 'google.com' ||
  /(^|\.)google\.[a-z.]+$/.test(host); // google.co.in, google.de, …

// Pull a { latitude, longitude } pair out of a Google Maps URL or page body.
// Tries the most precise patterns first.
export const extractLatLng = (text) => {
  if (!text) return null;
  const patterns = [
    // The authoritative place pin lives in the data param: !3d<lat>!4d<lng>
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    // Map centre in the path: /@<lat>,<lng>,<zoom>z
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    // Query forms: ?q=lat,lng  ll=lat,lng  sll=lat,lng  destination=lat,lng
    /[?&](?:q|ll|sll|saddr|daddr|destination|center)=(-?\d+(?:\.\d+)?),\+?(-?\d+(?:\.\d+)?)/,
    // /search/<lat>,+<lng> style
    /\/search\/(-?\d+(?:\.\d+)?),\+?(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const latitude = Number(m[1]);
      const longitude = Number(m[2]);
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      ) {
        return { latitude, longitude };
      }
    }
  }
  return null;
};

export const geoService = {
  /**
   * Resolve a Google Maps link (short maps.app.goo.gl or a full URL) to
   * coordinates. Short links carry no coords, so we follow the redirect and
   * read the final URL (then the page body as a fallback).
   */
  async resolveMapLink(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      throw ApiError.badRequest('That does not look like a valid URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw ApiError.badRequest('Only http(s) links are supported');
    }
    if (!isGoogleHost(url.hostname)) {
      throw ApiError.badRequest('Please paste a Google Maps link');
    }

    // A full URL may already contain the coordinates — no network needed.
    const direct = extractLatLng(url.href);
    if (direct) return direct;

    // Otherwise follow the short link and inspect where it lands.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url.href, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          // A browser UA makes Google hand back the place URL rather than a stub.
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept-Language': 'en',
        },
      });

      // The final URL after redirects usually carries @lat,lng or !3d!4d.
      const fromFinalUrl = extractLatLng(res.url);
      if (fromFinalUrl) return fromFinalUrl;

      // Fall back to scanning the HTML for the same patterns.
      const body = await res.text();
      const fromBody = extractLatLng(body);
      if (fromBody) return fromBody;

      throw ApiError.badRequest(
        'Could not read coordinates from that link. Open it in Google Maps, then copy the link again or enter the values manually.',
      );
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.warn(`Map-link resolve failed for ${url.href}: ${err.message}`);
      throw ApiError.badRequest('Could not resolve that Google Maps link. Try again or enter coordinates manually.');
    } finally {
      clearTimeout(timeout);
    }
  },
};
