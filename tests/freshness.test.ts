// Freshness rules for the morning run and the turnover copy.
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '@/lib/domain/config';
import { bridgeDownMessage, latestOkRunId, morningFreshness, turnoverFreshness } from '@/lib/domain/freshness';
import type { Heartbeat } from '@/lib/feed/validators';

const cfg = parseConfig([]);
const Z = 'America/Toronto';
const at = (s: string) => DateTime.fromISO(s, { zone: Z });
const hb = (run: string, status: Heartbeat['status'], start: string, end = ''): Heartbeat => ({ job: 'morning', run_id: run, started_at: start, finished_at: end, status, summary: '', counts: '' });
const okRun = (day: string) => [hb(`${day}-morning-0840`, 'running', `${day}T08:40:00-05:00`), hb(`${day}-morning-0840`, 'ok', `${day}T08:40:00-05:00`, `${day}T08:52:00-05:00`)];

describe('morningFreshness', () => {
  it('fresh when an ok run finished today', () => {
    const f = morningFreshness(at('2026-11-12T10:00:00'), okRun('2026-11-12'), cfg);
    expect(f.state).toBe('fresh');
    expect(f.message).toBe('Updated 8:52 AM');
  });
  it('waiting before the due time, labelled with the weekday', () => {
    const f = morningFreshness(at('2026-11-12T08:00:00'), okRun('2026-11-11'), cfg);
    expect(f.state).toBe('waiting');
    expect(f.message).toBe('From Wednesday');
  });
  it('waiting on a weekend', () => {
    const f = morningFreshness(at('2026-11-14T15:00:00'), okRun('2026-11-13'), cfg); // Saturday
    expect(f.state).toBe('waiting');
    expect(f.message).toBe('From Friday');
  });
  it('stale on a run day past the due time with no ok run today', () => {
    const f = morningFreshness(at('2026-11-12T11:00:00'), okRun('2026-11-10'), cfg);
    expect(f.state).toBe('stale');
    expect(f.message).toBe('STALE: no run today, last update Tue 8:52 AM');
  });
  it('stale when the newest run failed', () => {
    const rows = [...okRun('2026-11-11'), hb('2026-11-12-morning-0840', 'failed', '2026-11-12T08:40:00-05:00', '2026-11-12T08:45:00-05:00')];
    expect(morningFreshness(at('2026-11-12T09:00:00'), rows, cfg).state).toBe('stale');
  });
  it('stale when a running row is older than 30 minutes, fine when younger', () => {
    const running = [hb('2026-11-12-morning-0840', 'running', '2026-11-12T08:40:00-05:00')];
    expect(morningFreshness(at('2026-11-12T09:30:00'), running, cfg).state).toBe('stale');
    expect(morningFreshness(at('2026-11-12T09:00:00'), running, cfg).state).not.toBe('stale');
  });
  it('stale with no update yet when there are no runs after the due time', () => {
    const f = morningFreshness(at('2026-11-12T12:00:00'), [], cfg);
    expect(f.message).toBe('STALE: no run today, no update yet');
  });
  it('works across a daylight-saving change (fall back 2026-11-01)', () => {
    const before = [hb('2026-10-30-morning-0840', 'ok', '2026-10-30T08:40:00-04:00', '2026-10-30T08:52:00-04:00')];
    expect(morningFreshness(at('2026-11-02T08:00:00'), before, cfg).message).toBe('From Friday');
    const after = okRun('2026-11-02');
    expect(morningFreshness(at('2026-11-02T10:00:00'), after, cfg).state).toBe('fresh');
  });
  it('works across a daylight-saving change (spring forward 2026-03-08)', () => {
    const rows = [hb('2026-03-06-morning-0840', 'ok', '2026-03-06T08:40:00-05:00', '2026-03-06T08:52:00-05:00')];
    const f = morningFreshness(at('2026-03-09T09:00:00'), rows, cfg); // Monday, before 09:30
    expect(f.state).toBe('waiting');
    expect(f.message).toBe('From Friday');
  });
});

describe('latestOkRunId', () => {
  it('ignores failed and running rows', () => {
    const rows = [...okRun('2026-11-10'), ...okRun('2026-11-11'), hb('2026-11-12-morning-0840', 'failed', '2026-11-12T08:40:00-05:00'), hb('2026-11-12-morning-0900', 'running', '2026-11-12T09:00:00-05:00')];
    expect(latestOkRunId(rows)).toBe('2026-11-11-morning-0840');
    expect(latestOkRunId([])).toBeNull();
  });
});

describe('turnoverFreshness', () => {
  it('fresh, stale, missing stamp and bad', () => {
    const now = at('2026-11-12T10:00:00');
    expect(turnoverFreshness(now, true, at('2026-11-11T19:43:00'), cfg).state).toBe('fresh');
    expect(turnoverFreshness(now, true, at('2026-11-08T19:43:00'), cfg).state).toBe('stale');
    expect(turnoverFreshness(now, true, null, cfg).state).toBe('stale');
    expect(turnoverFreshness(now, false, null, cfg).message).toContain('Turnover copy unavailable');
  });
  it('bridge down message', () => {
    expect(bridgeDownMessage(at('2026-11-12T10:00:00'), at('2026-11-12T09:41:00'), Z)).toBe('Cannot reach your data since 09:41');
  });
});
