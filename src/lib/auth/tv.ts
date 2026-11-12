// TV pairing: the private link carries a key; a matching key sets a cookie holding an HMAC of it.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TV_COOKIE = 'tv_pair';

function digest(s: string): Buffer {
  return createHmac('sha256', 'tv-compare').update(s).digest();
}

/** Constant-time comparison of the supplied key with TV_KEY. */
export function tvKeyMatches(supplied: string | null | undefined, expected: string | null | undefined): boolean {
  if (!supplied || !expected) return false;
  return timingSafeEqual(digest(supplied), digest(expected));
}

export function tvCookieValue(tvKey: string, authSecret: string): string {
  return createHmac('sha256', authSecret || 'no-secret').update('tv-cookie:' + tvKey).digest('hex');
}

export function tvCookieValid(cookie: string | null | undefined, tvKey: string | null | undefined, authSecret: string | null | undefined): boolean {
  if (!cookie || !tvKey) return false;
  return tvKeyMatches(cookie, tvCookieValue(tvKey, authSecret ?? ''));
}

export interface TvPairing { redirectToClean: true; cookieValue: string | null }

/** Handles GET /tv?k=<key>. Returns null when there is no `k` parameter. A wrong key sets no cookie. */
export function pairTv(search: URLSearchParams, tvKey: string | undefined, authSecret: string | undefined): TvPairing | null {
  if (!search.has('k')) return null;
  const ok = tvKeyMatches(search.get('k'), tvKey);
  return { redirectToClean: true, cookieValue: ok && tvKey ? tvCookieValue(tvKey, authSecret ?? '') : null };
}
