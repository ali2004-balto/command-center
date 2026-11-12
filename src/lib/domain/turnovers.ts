// Pure summary of the turnover copy: counts, waiting-on-me, today, per-person and moves since yesterday.
import { DateTime } from 'luxon';
import type { AppConfig } from './config';
import { COMPLETE, STAGES, STEP_LABELS, type StepKey, type TrackerParsed, type Unit } from './tracker';

export interface TodayEntry { kind: 'turnover' | 'step'; time: string; sortKey: string; title: string; unitLabel: string }
export interface TurnoverSummary {
  ok: boolean;
  reason?: string;
  stamp: DateTime | null;
  active: Unit[];
  stageCounts: { stage: string; count: number }[];
  otherCount: number;
  overdue: number;
  blocked: number;
  dueSoon: number;
  waitingOnMe: Unit[];
  today: TodayEntry[];
  perPerson: { person: string; units: Unit[] }[];
  movedSince: string[];
  problems: string[];
}

export function unitLabel(u: { property: string; unit: string }) {
  return `${u.property} ${u.unit}`.trim();
}
export function shortStage(stage: string) {
  return stage.replace(/^\d+\.\s*/, '');
}

export function summarizeTurnovers(
  tracker: TrackerParsed,
  config: AppConfig,
  now: DateTime,
  snapshot: { rows: { property: string; unit: string; stage: string }[] } | null = null,
): TurnoverSummary {
  if (!tracker.ok) {
    return { ok: false, reason: tracker.reason, stamp: null, active: [], stageCounts: STAGES.map((s) => ({ stage: s, count: 0 })), otherCount: 0, overdue: 0, blocked: 0, dueSoon: 0, waitingOnMe: [], today: [], perPerson: [], movedSince: [], problems: [] };
  }
  const active = tracker.units.filter((u) => u.stage !== COMPLETE);
  const stageCounts = STAGES.map((s) => ({ stage: s as string, count: active.filter((u) => u.stage === s).length }));
  const otherCount = active.filter((u) => !(STAGES as readonly string[]).includes(u.stage)).length;
  const todayStr = now.setZone(config.timezone).toFormat('yyyy-MM-dd');

  const today: TodayEntry[] = [];
  for (const u of active) {
    const label = unitLabel(u);
    if (u.targetReady === todayStr) today.push({ kind: 'turnover', time: '', sortKey: '99', title: `${label} target ready date`, unitLabel: label });
    (Object.keys(u.steps) as StepKey[]).forEach((k) => {
      const s = u.steps[k];
      if ((s.status === 'Scheduled' || s.status === 'In progress') && s.date === todayStr) {
        today.push({ kind: 'step', time: '', sortKey: '98', title: `${label}: ${STEP_LABELS[k]} ${s.status.toLowerCase()}`, unitLabel: label });
      }
    });
  }

  const groups = new Map<string, Unit[]>();
  for (const u of active.filter((x) => x.stage === '3. In-house work')) {
    const p = u.assignedTo || 'Unassigned';
    groups.set(p, [...(groups.get(p) ?? []), u]);
  }
  const perPerson = [...groups.entries()]
    .map(([person, units]) => ({ person, units }))
    .sort((a, b) => (a.person === 'Unassigned' ? 1 : b.person === 'Unassigned' ? -1 : a.person.localeCompare(b.person)));

  const movedSince: string[] = [];
  if (snapshot) {
    const before = new Map(snapshot.rows.map((r) => [`${r.property}|${r.unit}`, r.stage]));
    for (const u of tracker.units) {
      const was = before.get(`${u.property}|${u.unit}`);
      if (was !== undefined && was !== u.stage) {
        movedSince.push(`${unitLabel(u)} moved to ${u.stage === COMPLETE ? 'Complete' : shortStage(u.stage)}`);
      }
    }
  }

  return {
    ok: true,
    stamp: tracker.stamp,
    active,
    stageCounts,
    otherCount,
    overdue: active.filter((u) => u.flag === 'Overdue').length,
    blocked: active.filter((u) => u.flag === 'Blocked').length,
    dueSoon: active.filter((u) => u.flag === 'Due soon').length,
    waitingOnMe: active.filter((u) => config.myStages.includes(u.stage)),
    today,
    perPerson,
    movedSince,
    problems: tracker.problems,
  };
}
