// Server actions: owner only, origin checked, and each mutation writes an Audit row in the mock.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ origin: 'https://app.example.com' as string | null }));
vi.mock('next/headers', () => ({
  headers: async () => {
    const m = new Headers({ host: 'app.example.com' });
    if (h.origin) m.set('origin', h.origin);
    return m;
  },
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/session', async (orig) => ({ ...(await orig<any>()), getActor: vi.fn() }));

import { decideDraftAction, dismissAction, setSwitchAction, setViewAction } from '@/app/actions';
import * as session from '@/lib/auth/session';
import { getMockBridge, resetMockBridge } from '@/lib/bridge/mock';

const getActor = vi.mocked(session.getActor);
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const owner = { role: 'owner' as const, email: 'owner@example.com' };

beforeEach(() => {
  vi.stubEnv('BRIDGE_MODE', 'mock');
  resetMockBridge();
  h.origin = 'https://app.example.com';
  getActor.mockResolvedValue(owner);
});

describe('mutations refuse non-owners', () => {
  it.each([
    ['setSwitch', () => setSwitchAction(form({ name: 'team_views', on: 'true' }))],
    ['setView', () => setViewAction(form({ view: 'team', status: 'live' }))],
    ['dismiss', () => dismissAction(form({ id: 'manual:call-vendor' }))],
    ['decide', () => decideDraftAction(form({ draftId: 'd-1', decision: 'reject' }))],
  ])('%s with no session changes nothing', async (_n, run) => {
    getActor.mockResolvedValue(null);
    await expect(run()).rejects.toBeDefined();
    expect(getMockBridge().state.audit).toHaveLength(0);
    expect(getMockBridge().state.tabs.Switches.every((r) => r.on === 'FALSE')).toBe(true);
  });
  it('a TV-only actor changes nothing', async () => {
    getActor.mockResolvedValue({ role: 'tv', email: '' } as any);
    await expect(setSwitchAction(form({ name: 'team_views', on: 'true' }))).rejects.toBeDefined();
    expect(getMockBridge().state.audit).toHaveLength(0);
  });
  it('a foreign or missing origin changes nothing', async () => {
    h.origin = 'https://evil.example.net';
    await expect(setSwitchAction(form({ name: 'team_views', on: 'true' }))).rejects.toThrow();
    h.origin = null;
    await expect(setSwitchAction(form({ name: 'team_views', on: 'true' }))).rejects.toThrow();
    expect(getMockBridge().state.audit).toHaveLength(0);
  });
});

describe('owner mutations write Audit rows', () => {
  const run = async (fn: () => Promise<void>) => fn().catch((e) => e);
  it('setSwitch', async () => {
    await run(() => setSwitchAction(form({ name: 'team_views', on: 'true' })));
    const b = getMockBridge().state;
    expect(b.tabs.Switches.find((r) => r.switch === 'team_views')!.on).toBe('TRUE');
    expect(b.audit).toEqual([expect.objectContaining({ action: 'setSwitch', target: 'team_views', actor: 'owner@example.com' })]);
  });
  it('setView', async () => {
    await run(() => setViewAction(form({ view: 'team', status: 'live' })));
    expect(getMockBridge().state.audit[0]).toMatchObject({ action: 'setView', target: 'team', detail: 'live' });
  });
  it('dismiss', async () => {
    await run(() => dismissAction(form({ id: 'manual:call-vendor' })));
    expect(getMockBridge().state.tabs.NeedsMe.find((r) => r.id === 'manual:call-vendor')!.handled_at).not.toBe('');
    expect(getMockBridge().state.audit[0]).toMatchObject({ action: 'dismiss' });
  });
  it('rejects unknown switch names', async () => {
    await run(() => setSwitchAction(form({ name: 'bogus', on: 'true' })));
    expect(getMockBridge().state.audit).toHaveLength(0);
  });
});
