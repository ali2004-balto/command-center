// TV pairing, getFeed caching and the health route.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pairTv, tvCookieValid, tvCookieValue, tvKeyMatches } from '@/lib/auth/tv';
import { clearFeedCache, getFeed, MAX_AGE_MS } from '@/lib/bridge/feed';
import { freshBridge } from './helpers/model';

describe('TV key', () => {
  it('accepts the right key and rejects others', () => {
    expect(tvKeyMatches('abc', 'abc')).toBe(true);
    expect(tvKeyMatches('abd', 'abc')).toBe(false);
    expect(tvKeyMatches('', 'abc')).toBe(false);
    expect(tvKeyMatches('abc', undefined)).toBe(false);
  });
  it('pairs only with a matching key', () => {
    expect(pairTv(new URLSearchParams(''), 'key', 'sec')).toBeNull();
    expect(pairTv(new URLSearchParams('k=key'), 'key', 'sec')?.cookieValue).toBe(tvCookieValue('key', 'sec'));
    expect(pairTv(new URLSearchParams('k=nope'), 'key', 'sec')?.cookieValue).toBeNull();
  });
  it('checks the cookie, and a rotated key invalidates it', () => {
    const c = tvCookieValue('key', 'sec');
    expect(tvCookieValid(c, 'key', 'sec')).toBe(true);
    expect(tvCookieValid(c, 'new-key', 'sec')).toBe(false);
    expect(tvCookieValid('forged', 'key', 'sec')).toBe(false);
    expect(tvCookieValid(undefined, 'key', 'sec')).toBe(false);
  });
});

describe('getFeed', () => {
  beforeEach(() => clearFeedCache());
  const bridge = () => {
    const b = freshBridge();
    return { b, call: vi.fn((a: string, p: unknown) => b.handle(a, p)) };
  };
  it('returns a validated feed and caches for up to 120 s', async () => {
    const { call } = bridge();
    const r1 = await getFeed(1_000_000, call as any);
    expect(r1.ok).toBe(true);
    await getFeed(1_000_000 + 60_000, call as any);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('never serves data older than 120 seconds as current', async () => {
    const b = freshBridge();
    let fail = false;
    const call = vi.fn(async (a: string, p: unknown) => (fail ? ({ ok: false, error: 'unreachable' } as const) : b.handle(a, p)));
    await getFeed(1_000_000, call as any);
    fail = true;
    const late = await getFeed(1_000_000 + MAX_AGE_MS + 1, call as any);
    expect(late).toEqual({ ok: false, lastGoodAt: 1_000_000 });
  });
  it('rejects malformed Bridge data', async () => {
    const r = await getFeed(5, (async () => ({ ok: true, data: { nope: 1 } })) as any);
    expect(r.ok).toBe(false);
  });
});

describe('/api/health', () => {
  it('exposes nothing but ok', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = GET();
    expect(await res.json()).toEqual({ ok: true });
  });
});
