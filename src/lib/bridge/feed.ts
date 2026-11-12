// getFeed(): Bridge `feed` action, validated, remembered for at most 120 seconds. Never serves older data as current.
import { FeedData, type FeedDataT } from '../feed/validators';
import { callBridge } from './client';

export const MAX_AGE_MS = 120_000;
export type FeedResult = { ok: true; feed: FeedDataT; fetchedAt: number } | { ok: false; lastGoodAt: number | null };

interface Cache { feed: FeedDataT; fetchedAt: number }
const g = globalThis as unknown as { __feedCache?: Cache };

export function clearFeedCache() {
  delete g.__feedCache;
}

export async function getFeed(nowMs: number = Date.now(), call: typeof callBridge = callBridge): Promise<FeedResult> {
  const cached = g.__feedCache;
  if (cached && nowMs - cached.fetchedAt <= MAX_AGE_MS && nowMs >= cached.fetchedAt) {
    return { ok: true, feed: cached.feed, fetchedAt: cached.fetchedAt };
  }
  const res = await call('feed', {});
  if (res.ok) {
    const parsed = FeedData.safeParse(res.data);
    if (parsed.success) {
      g.__feedCache = { feed: parsed.data, fetchedAt: nowMs };
      return { ok: true, feed: parsed.data, fetchedAt: nowMs };
    }
  }
  return { ok: false, lastGoodAt: cached?.fetchedAt ?? null };
}
