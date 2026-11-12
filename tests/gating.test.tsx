// Switch and view gating on the server; preview versus live.
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/session', async (orig) => ({ ...(await orig<any>()), getActor: vi.fn(async () => ({ role: 'owner', email: 'owner@example.com' })) }));

import { viewAccess } from '@/lib/domain/access';
import { getMockBridge, resetMockBridge } from '@/lib/bridge/mock';
import { clearFeedCache } from '@/lib/bridge/feed';
import ApprovalsPage from '@/app/approvals/page';
import PreviewPage from '@/app/preview/[view]/page';
import TeamPage from '@/app/team/page';

beforeEach(() => {
  vi.stubEnv('BRIDGE_MODE', 'mock');
  resetMockBridge();
  clearFeedCache();
});
const setSwitch = (name: string, on: string) => (getMockBridge().state.tabs.Switches.find((r) => r.switch === name)!.on = on);
const setView = (view: string, status: string) => (getMockBridge().state.tabs.Views.find((r) => r.view === view)!.status = status);
const is404 = (e: any) => String(e?.digest ?? '').includes('404');

describe('viewAccess', () => {
  const m = (sw: boolean, st: 'live' | 'preview') => ({ switches: { team_views: sw }, views: { team: st } });
  it('table', () => {
    expect(viewAccess(m(false, 'live'), 'team', 'team_views', 'live')).toBe('notFound');
    expect(viewAccess(m(true, 'preview'), 'team', 'team_views', 'live')).toBe('notLive');
    expect(viewAccess(m(true, 'live'), 'team', 'team_views', 'live')).toBe('show');
    expect(viewAccess(m(true, 'preview'), 'team', 'team_views', 'preview')).toBe('show');
    expect(viewAccess(m(true, 'live'), 'team', 'team_views', 'preview')).toBe('redirectLive');
    expect(viewAccess({ switches: {}, views: {} }, 'team', 'team_views', 'preview')).toBe('notFound');
  });
});

describe('Team page', () => {
  it('is not found when its switch is off', async () => {
    setView('team', 'live');
    await expect(TeamPage()).rejects.toSatisfy(is404);
  });
  it('is not found when the switches tab is unreadable (counts as OFF)', async () => {
    setView('team', 'live');
    (getMockBridge().state.tabs.Switches as any) = [{ nonsense: 'x' }];
    await expect(TeamPage()).rejects.toSatisfy(is404);
  });
  it('says "not live yet" in preview, and shows when live', async () => {
    setSwitch('team_views', 'TRUE');
    expect(renderToStaticMarkup(await TeamPage())).toContain('This view is not live yet');
    setView('team', 'live');
    clearFeedCache();
    const html = renderToStaticMarkup(await TeamPage());
    expect(html).toContain('Sam Example');
    expect(html).toContain('Unassigned');
  });
  it('preview route shows a banner for a preview view', async () => {
    setSwitch('team_views', 'TRUE');
    const html = renderToStaticMarkup(await PreviewPage({ params: Promise.resolve({ view: 'team' }) }));
    expect(html).toContain('PREVIEW: not live');
  });
  it('preview route redirects once live and 404s for unknown views', async () => {
    setSwitch('team_views', 'TRUE');
    setView('team', 'live');
    await expect(PreviewPage({ params: Promise.resolve({ view: 'team' }) })).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') });
    await expect(PreviewPage({ params: Promise.resolve({ view: 'bogus' }) })).rejects.toSatisfy(is404);
  });
});

describe('Approvals page', () => {
  it('is hidden when the drafts switch is off', async () => {
    setView('approvals', 'live');
    await expect(ApprovalsPage({ searchParams: Promise.resolve({}) })).rejects.toSatisfy(is404);
  });
  it('is not live while its view is in preview', async () => {
    setSwitch('drafts', 'TRUE');
    expect(renderToStaticMarkup(await ApprovalsPage({ searchParams: Promise.resolve({}) }))).toContain('This view is not live yet');
  });
  it('lists proposed drafts with the Gmail link when live', async () => {
    setSwitch('drafts', 'TRUE');
    setView('approvals', 'live');
    const html = renderToStaticMarkup(await ApprovalsPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Re: Tuesday access');
    expect(html).toContain('Open in Gmail');
    expect(html).toContain('this app sends nothing');
  });
});
