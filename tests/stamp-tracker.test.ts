// Stamp parsing, tracker parsing and the turnover summary.
import { describe, expect, it } from 'vitest';
import { parseAppStamp, stampToInstant } from '@/lib/domain/stamp';
import { parseTracker } from '@/lib/domain/tracker';
import { summarizeTurnovers } from '@/lib/domain/turnovers';
import { parseConfig } from '@/lib/domain/config';
import { makeTrackerGrid, TRACKER_HEADINGS } from '@/lib/bridge/fixtures';
import { loadBridge } from './helpers/bridge';
import { NOW } from './helpers/model';

const cfg = parseConfig([{ key: 'my_stages', value: '2. Scope of work; 6. Leasing upload' }]);
const stamp = (t: string) => `From the app (${t}). Make changes in the app.`;

describe('parseAppStamp', () => {
  it('parses a.m. and p.m.', () => {
    expect(parseAppStamp(stamp('Nov 11, 2026, 7:43 p.m.'))).toEqual({ year: 2026, month: 11, day: 11, hour: 19, minute: 43 });
    expect(parseAppStamp(stamp('Nov 11, 2026, 7:43 a.m.'))?.hour).toBe(7);
  });
  it('handles 12:05 a.m. and 12:30 p.m.', () => {
    expect(parseAppStamp(stamp('Mar 3, 2026, 12:05 a.m.'))).toMatchObject({ hour: 0, minute: 5 });
    expect(parseAppStamp(stamp('Mar 3, 2026, 12:30 p.m.'))).toMatchObject({ hour: 12, minute: 30 });
  });
  it('handles "Sept." and garbage', () => {
    expect(parseAppStamp(stamp('Sept. 9, 2026, 1:00 p.m.'))).toMatchObject({ month: 9, hour: 13 });
    expect(parseAppStamp('nothing here')).toBeNull();
    expect(parseAppStamp('')).toBeNull();
    expect(parseAppStamp(undefined)).toBeNull();
  });
  it('matches the Bridge copy of the parser', () => {
    const b = loadBridge('pure.js');
    const t = stamp('Sept. 9, 2026, 12:30 p.m.');
    expect(b.parseAppStamp(t)).toEqual(parseAppStamp(t));
  });
  it('converts Toronto wall time to an instant in January and July', () => {
    expect(stampToInstant(stamp('Jan 15, 2026, 7:43 p.m.'))?.toUTC().toISO()).toBe('2026-01-16T00:43:00.000Z');
    expect(stampToInstant(stamp('Jul 15, 2026, 7:43 p.m.'))?.toUTC().toISO()).toBe('2026-07-15T23:43:00.000Z');
    expect(stampToInstant('bad')).toBeNull();
  });
});

describe('parseTracker', () => {
  it('pads ragged rows and skips empty ones', () => {
    const grid = makeTrackerGrid(NOW);
    grid[3] = grid[3].slice(0, 8); // trailing cells missing
    grid.push(['', '']);
    grid.push([]);
    const t = parseTracker(grid);
    expect(t.ok).toBe(true);
    if (t.ok) {
      expect(t.units).toHaveLength(18);
      expect(t.units[0].notes).toBe('');
    }
  });
  it('a missing heading is BAD DATA', () => {
    const grid = makeTrackerGrid(NOW);
    grid[2] = grid[2].map((h) => (h === 'Current stage' ? 'Stage' : h));
    expect(parseTracker(grid)).toEqual({ ok: false, reason: 'Turnover copy unavailable' });
  });
  it('a spreadsheet error in A1 is BAD DATA', () => {
    const grid = makeTrackerGrid(NOW);
    grid[0][0] = '#REF!';
    expect(parseTracker(grid).ok).toBe(false);
    expect(parseTracker([]).ok).toBe(false);
  });
  it('records a bad date as a problem and treats it as empty', () => {
    const grid = makeTrackerGrid(NOW);
    grid[3][TRACKER_HEADINGS.indexOf('Target ready date')] = 'next week';
    const t = parseTracker(grid);
    expect(t.ok && t.problems).toHaveLength(1);
    expect(t.ok && t.units[0].targetReady).toBe('');
  });
  it('matches the Bridge copy of the grid reader', () => {
    const grid = makeTrackerGrid(NOW);
    const rows = loadBridge('pure.js').parseTrackerGrid(grid);
    expect(rows).toHaveLength(18);
    expect(rows[0]).toEqual({ property: 'Maple Court', unit: '12', stage: '1. Inspection' });
  });
});

describe('summarizeTurnovers', () => {
  const parsed = parseTracker(makeTrackerGrid(NOW));
  const snap = { rows: [{ property: 'Maple Court', unit: '33', stage: '2. Scope of work' }, { property: 'Cedar Place', unit: '3C', stage: '3. In-house work' }] };
  const sum = summarizeTurnovers(parsed, cfg, NOW, snap);

  it('counts active units and stages in order', () => {
    expect(sum.active).toHaveLength(16);
    expect(sum.stageCounts.map((s) => s.count)).toEqual([2, 3, 5, 2, 2, 2]);
    expect(sum.stageCounts[0].stage).toBe('1. Inspection');
  });
  it('counts flags', () => {
    expect(sum.overdue).toBe(2);
    expect(sum.blocked).toBe(1);
    expect(sum.dueSoon).toBe(3);
  });
  it('finds units waiting on me for the two configured stages', () => {
    expect(sum.waitingOnMe.map((u) => u.stage).sort()).toEqual(['2. Scope of work', '2. Scope of work', '2. Scope of work', '6. Leasing upload', '6. Leasing upload']);
  });
  it('builds today from target dates and scheduled steps', () => {
    const titles = sum.today.map((t) => t.title);
    expect(titles).toContain('Cedar Place 4A target ready date');
    expect(titles).toContain('Cedar Place 4A: Cleaning scheduled');
    expect(titles).toContain('Maple Court 33: In-house work scheduled');
  });
  it('groups in-house work per person with Unassigned last', () => {
    expect(sum.perPerson.map((p) => p.person)).toEqual(['Pat Sample', 'Sam Example', 'Unassigned']);
  });
  it('phrases moves since the snapshot', () => {
    expect(sum.movedSince).toEqual(['Maple Court 33 moved to In-house work', 'Cedar Place 3C moved to Cleaning']);
  });
  it('reports BAD DATA when the tracker is unusable', () => {
    const bad = summarizeTurnovers({ ok: false, reason: 'Turnover copy unavailable' }, cfg, NOW);
    expect(bad.ok).toBe(false);
  });
});
