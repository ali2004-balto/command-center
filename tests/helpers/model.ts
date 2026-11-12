// Test helpers: a fixed "now" and a model built from the mock Bridge fixture.
import { DateTime } from 'luxon';
import { createMockBridge, type MockBridge } from '@/lib/bridge/mock';
import { buildModel } from '@/lib/domain/model';
import { FeedData } from '@/lib/feed/validators';

export const NOW = DateTime.fromISO('2026-11-12T10:30:00', { zone: 'America/Toronto' }); // a Thursday

export async function modelFrom(bridge: MockBridge, now: DateTime = NOW) {
  const res = await bridge.handle('feed', {});
  if (!res.ok) throw new Error('feed failed');
  const feed = FeedData.parse(res.data);
  return buildModel({ result: { ok: true, feed, fetchedAt: now.toMillis() }, now, demo: true });
}

export function freshBridge(now: DateTime = NOW) {
  return createMockBridge(now, () => now.toMillis());
}
