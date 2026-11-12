// The model: needs merge, latest-ok-run filtering, DD window, chips, BAD DATA isolation, stale notices.
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { chipColor } from '@/lib/domain/projects';
import { ddCards } from '@/lib/domain/needs';
import { parseConfig } from '@/lib/domain/config';
import { buildModel } from '@/lib/domain/model';
import { FeedData } from '@/lib/feed/validators';
import { freshBridge, modelFrom, NOW } from './helpers/model';

const cfg = parseConfig([]);
const dl = (date: string, kind = 'dd') => ({ run_id: 'r', project: 'P', label: 'L', date, kind, source: 's' });

describe('buildNeeds merge', () => {
  it('orders turnover, DD, NeedsMe by source then category, then the drafts card', async () => {
    const b = freshBridge();
    b.state.tabs.Switches.find((r) => r.switch === 'drafts')!.on = 'TRUE';
    const m = await modelFrom(b);
    const keys = m.needs.map((n) => n.key);
    const firstDd = keys.findIndex((k) => k.startsWith('dd:'));
    expect(keys.slice(0, 5).every((k) => k.startsWith('turnover:'))).toBe(true);
    expect(firstDd).toBe(5);
    expect(keys.slice(6, 9)).toEqual(['needs:email:t-100', 'needs:email:t-101', 'needs:manual:call-vendor']);
    expect(keys[keys.length - 1]).toBe('drafts');
    expect(m.needs[m.needs.length - 1].title).toBe('2 drafts ready on your phone');
  });
  it('has no drafts card when the drafts switch is off', async () => {
    const m = await modelFrom(freshBridge());
    expect(m.needs.some((n) => n.key === 'drafts')).toBe(false);
  });
  it('always shows unhandled manual rows, hides handled rows, hides other runs', async () => {
    const b = freshBridge();
    b.state.tabs.Heartbeat.push({ ...b.state.tabs.Heartbeat[1], run_id: '2026-11-12-morning-1100', status: 'running', finished_at: '', started_at: NOW.toISO()! });
    b.state.tabs.NeedsMe[0].run_id = 'old-run';
    b.state.tabs.NeedsMe[1].handled_at = '2026-11-12T09:00:00-05:00';
    // Both email rows are now hidden (other run / handled); the manual row stays.
    const m = await modelFrom(b);
    const ids = m.needs.filter((n) => n.id).map((n) => n.id);
    expect(ids).toEqual(['manual:call-vendor']);
    b.state.tabs.NeedsMe[2].handled_at = 'x';
    expect((await modelFrom(b)).needs.some((n) => n.id === 'manual:call-vendor')).toBe(false);
  });
  it('only shows rows for the latest ok run even with a newer failed run', async () => {
    const b = freshBridge();
    b.state.tabs.Heartbeat.push({ ...b.state.tabs.Heartbeat[1], run_id: '2026-11-12-morning-1000', status: 'failed', started_at: NOW.toISO()!, finished_at: NOW.toISO()! });
    const m = await modelFrom(b);
    expect(m.briefingHeadline).toContain('Sorted 14 emails');
    expect(m.morning.state).toBe('stale');
    expect(m.doneNotice).toContain('STALE');
  });
});

describe('DD window', () => {
  it('includes today and day 14, excludes yesterday and day 15', () => {
    const d = (n: number) => NOW.plus({ days: n }).toFormat('yyyy-MM-dd');
    const cards = ddCards([dl(d(-1)), dl(d(0)), dl(d(14)), dl(d(15)), dl(d(3), 'closing')], cfg, NOW);
    expect(cards.map((c) => c.due)).toEqual([d(0), d(14)]);
  });
});

describe('project chips', () => {
  const d = (n: number) => NOW.plus({ days: n }).toFormat('yyyy-MM-dd');
  it('colours', () => {
    expect(chipColor({ blocked: 'TRUE', next_date: d(30) }, NOW)).toBe('red');
    expect(chipColor({ blocked: 'FALSE', next_date: d(-1) }, NOW)).toBe('red');
    expect(chipColor({ blocked: 'FALSE', next_date: d(0) }, NOW)).toBe('amber');
    expect(chipColor({ blocked: 'FALSE', next_date: d(7) }, NOW)).toBe('amber');
    expect(chipColor({ blocked: 'FALSE', next_date: d(8) }, NOW)).toBe('green');
    expect(chipColor({ blocked: 'FALSE', next_date: '' }, NOW)).toBe('green');
  });
  it('model chips come from the latest ok run and show one as-of date', async () => {
    const m = await modelFrom(freshBridge());
    expect(m.chips?.map((c) => c.color)).toEqual(['amber', 'green', 'red']);
    expect(m.chipsAsOf).toBe(NOW.minus({ days: 2 }).toFormat('yyyy-MM-dd'));
  });
  it('says project status appears after the first morning run when none exists', async () => {
    const b = freshBridge();
    b.state.tabs.Heartbeat = [];
    expect((await modelFrom(b)).chipsMessage).toBe('Project status appears after the first morning run');
  });
});

describe('BAD DATA isolation and freshness', () => {
  it('one malformed tab only breaks its own panel', async () => {
    const b = freshBridge();
    b.state.tabs.Projects[0].next_date = 'soon';
    const m = await modelFrom(b);
    expect(m.chips).toBeNull();
    expect(m.chipsMessage).toContain('BAD DATA');
    expect(m.badTabs.map((t) => t.tab)).toEqual(['Projects']);
    expect(m.done.length).toBeGreaterThan(0);
    expect(m.briefingHeadline).not.toBe('');
    expect(m.needs.length).toBeGreaterThan(0);
    expect(m.turnovers.ok).toBe(true);
  });
  it('a bad Switches tab means everything is OFF', async () => {
    const b = freshBridge();
    b.state.tabs.Switches[0].on = 'maybe';
    const m = await modelFrom(b);
    expect(Object.values(m.switches).every((v) => v === false)).toBe(true);
  });
  it('a bad NeedsMe tab shows BAD DATA but keeps turnover cards', async () => {
    const b = freshBridge();
    b.state.tabs.NeedsMe[0].due = 'tomorrow';
    const m = await modelFrom(b);
    expect(m.needsNotice).toContain('BAD DATA');
    expect(m.needs.some((n) => n.key.startsWith('turnover:'))).toBe(true);
  });
  it('a stale morning run puts a STALE notice on every morning-run panel', async () => {
    const b = freshBridge();
    b.state.tabs.Heartbeat = b.state.tabs.Heartbeat.map((r) => ({ ...r, started_at: '2026-11-09T08:40:00-05:00', finished_at: r.finished_at && '2026-11-09T08:52:00-05:00', run_id: '2026-11-09-morning-0840' }));
    for (const t of ['Briefing', 'Done', 'NeedsMe', 'Projects', 'Deadlines']) b.state.tabs[t].forEach((r) => r.run_id && (r.run_id = '2026-11-09-morning-0840'));
    const m = await modelFrom(b);
    expect(m.morning.state).toBe('stale');
    expect(m.doneNotice).toContain('STALE');
    expect(m.needsNotice).toContain('STALE');
    expect(m.chipsMessage).toContain('STALE');
    expect(m.morning.message).toContain('last update Mon 8:52 AM');
  });
  it('a bad tracker shows "Turnover copy unavailable" and no counts are invented', async () => {
    const b = freshBridge();
    b.state.tracker[0][0] = '#REF!';
    const m = await modelFrom(b);
    expect(m.turnoverFresh.state).toBe('bad');
    expect(m.turnovers.ok).toBe(false);
    expect(m.needs.some((n) => n.key.startsWith('turnover:'))).toBe(false);
  });
  it('an old turnover stamp is stale', async () => {
    const b = freshBridge();
    b.state.tracker[0][4] = 'From the Unit Turnover app (Nov 1, 2026, 7:43 p.m.). Make changes in the app: this copy is replaced.';
    expect((await modelFrom(b)).turnoverFresh.state).toBe('stale');
  });
  it('a Bridge failure gives the full-screen message', () => {
    const m = buildModel({ result: { ok: false, lastGoodAt: NOW.minus({ minutes: 5 }).toMillis() }, now: NOW, demo: true });
    expect(m.bridgeDown).toBe('Cannot reach your data since 10:25');
    expect(m.needs).toEqual([]);
  });
  it('FeedData rejects junk', () => {
    expect(FeedData.safeParse({}).success).toBe(false);
  });
});

describe('Part 1 board with no morning run', () => {
  it('still has turnover moves and today from calendar and turnovers', async () => {
    const b = freshBridge();
    b.state.tabs.Heartbeat = [];
    for (const t of ['Briefing', 'Done', 'NeedsMe', 'Projects', 'Deadlines']) b.state.tabs[t] = [];
    const m = await modelFrom(b);
    expect(m.done).toEqual(['Maple Court 33 moved to In-house work', 'Cedar Place 3C moved to Cleaning']);
    expect(m.today.map((t) => t.title)).toEqual(expect.arrayContaining(['Site walk with Pat Sample', 'Cedar Place 4A target ready date']));
    const times = m.today.filter((t) => t.time && t.time !== 'All day').map((t) => t.time);
    expect(times).toEqual(['10:00 AM', '2:00 PM']);
    expect(DateTime.isDateTime(NOW)).toBe(true);
    b.state.snapshot = null;
    expect((await modelFrom(b)).done).toEqual(['No turnover steps moved since yesterday']);
  });
});
