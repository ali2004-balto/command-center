// Decides whether data is fresh, waiting (not due yet) or stale. Never shows old numbers as current.
import { DateTime } from 'luxon';
import type { Heartbeat } from '../feed/validators';
import type { AppConfig } from './config';

export type FreshState = 'fresh' | 'waiting' | 'stale';
export interface Freshness { state: FreshState; lastOkAt: DateTime | null; message: string }

function ts(v: string, zone: string): DateTime | null {
  if (!v) return null;
  const d = DateTime.fromISO(v, { zone });
  return d.isValid ? d : null;
}

export interface RunInfo { runId: string; status: 'running' | 'ok' | 'failed'; startedAt: DateTime | null; finishedAt: DateTime | null }

/** Collapse the append-only Heartbeat rows into one entry per morning run (final state wins). */
export function morningRuns(heartbeats: Heartbeat[], zone: string): RunInfo[] {
  const byRun = new Map<string, RunInfo>();
  for (const h of heartbeats) {
    if (h.job !== 'morning') continue;
    const cur = byRun.get(h.run_id);
    const next: RunInfo = { runId: h.run_id, status: h.status, startedAt: ts(h.started_at, zone), finishedAt: ts(h.finished_at, zone) };
    if (!cur) byRun.set(h.run_id, next);
    else {
      const rank = (s: string) => (s === 'running' ? 0 : 1);
      const winner = rank(next.status) >= rank(cur.status) ? next : cur;
      winner.startedAt = winner.startedAt ?? cur.startedAt ?? next.startedAt;
      byRun.set(h.run_id, winner);
    }
  }
  return [...byRun.values()].sort((a, b) => (a.startedAt?.toMillis() ?? 0) - (b.startedAt?.toMillis() ?? 0));
}

/** The run_id of the newest morning run whose status is ok. */
export function latestOkRunId(heartbeats: Heartbeat[], zone = 'America/Toronto'): string | null {
  const ok = morningRuns(heartbeats, zone).filter((r) => r.status === 'ok');
  return ok.length ? ok[ok.length - 1].runId : null;
}

export function fmtStamp(d: DateTime, now: DateTime): string {
  return d.hasSame(now, 'day') ? d.toFormat('h:mm a') : d.toFormat('ccc h:mm a');
}

export function morningFreshness(now: DateTime, heartbeats: Heartbeat[], config: AppConfig): Freshness {
  const zone = config.timezone;
  const n = now.setZone(zone);
  const runs = morningRuns(heartbeats, zone);
  const oks = runs.filter((r) => r.status === 'ok');
  const lastOk = oks.length ? oks[oks.length - 1] : null;
  const lastOkAt = lastOk ? (lastOk.finishedAt ?? lastOk.startedAt) : null;
  const staleMsg = (why: string) => `STALE: ${why}${lastOkAt ? `, last update ${fmtStamp(lastOkAt, n)}` : ', no update yet'}`;

  const newest = runs.length ? runs[runs.length - 1] : null;
  if (newest?.status === 'failed') return { state: 'stale', lastOkAt, message: staleMsg('last run failed') };
  if (newest?.status === 'running' && newest.startedAt && n.diff(newest.startedAt, 'minutes').minutes > 30) {
    return { state: 'stale', lastOkAt, message: staleMsg('run did not finish') };
  }
  if (lastOkAt && lastOkAt.hasSame(n, 'day')) return { state: 'fresh', lastOkAt, message: `Updated ${lastOkAt.toFormat('h:mm a')}` };

  const [hh, mm] = config.morningDueTime.split(':').map(Number);
  const due = n.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
  const isRunDay = config.morningDays.includes(n.weekday);
  if (!isRunDay || n < due) {
    return { state: 'waiting', lastOkAt, message: lastOkAt ? `From ${lastOkAt.toFormat('cccc')}` : 'No morning run yet' };
  }
  return { state: 'stale', lastOkAt, message: staleMsg('no run today') };
}

export interface TurnoverFreshness { state: 'fresh' | 'stale' | 'bad'; stampAt: DateTime | null; message: string }

export function turnoverFreshness(now: DateTime, trackerOk: boolean, stamp: DateTime | null, config: AppConfig): TurnoverFreshness {
  if (!trackerOk) return { state: 'bad', stampAt: null, message: 'BAD DATA: Turnover copy unavailable' };
  if (!stamp) return { state: 'stale', stampAt: null, message: 'STALE: turnover copy has no readable time' };
  const hours = now.diff(stamp, 'hours').hours;
  const label = stamp.setZone(config.timezone).toFormat('ccc LLL d, h:mm a');
  if (hours > config.turnoverStaleHours) return { state: 'stale', stampAt: stamp, message: `STALE: turnover copy is from ${label}` };
  return { state: 'fresh', stampAt: stamp, message: `As of ${label}` };
}

/** Full-screen message when the Bridge cannot be reached. */
export function bridgeDownMessage(now: DateTime, lastGoodAt: DateTime | null, zone: string): string {
  const since = lastGoodAt ?? now;
  return `Cannot reach your data since ${since.setZone(zone).toFormat('HH:mm')}`;
}
