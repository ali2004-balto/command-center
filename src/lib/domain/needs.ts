// Builds the "Needs you" cards from every source, in a fixed order.
import { DateTime } from 'luxon';
import type { Deadline, NeedsMe } from '../feed/validators';
import type { AppConfig } from './config';
import { shortStage, unitLabel, type TurnoverSummary } from './turnovers';

export interface NeedCard {
  key: string;
  /** NeedsMe id when the card can be dismissed. */
  id?: string;
  source: string;
  category: string;
  title: string;
  detail: string;
  link: string;
  due: string;
}

const SOURCE_ORDER = ['email', 'manual', 'status'];
const CATEGORY_ORDER = ['legal', 'pricing', 'complex', 'deadline', 'status', 'other'];
const rank = (list: string[], v: string) => {
  const i = list.indexOf(v);
  return i < 0 ? list.length : i;
};

export function turnoverCards(t: TurnoverSummary): NeedCard[] {
  return t.waitingOnMe.map((u) => ({
    key: `turnover:${unitLabel(u)}`, source: 'turnover', category: 'status',
    title: `${unitLabel(u)}: ${shortStage(u.stage)} is waiting on you`,
    detail: `Days in stage: ${u.daysInStage || 'unknown'}`, link: '', due: u.targetReady,
  }));
}

export function ddCards(deadlines: Deadline[], config: AppConfig, now: DateTime): NeedCard[] {
  const today = now.setZone(config.timezone).startOf('day');
  return deadlines
    .filter((d) => {
      if (d.kind !== 'dd' || !d.date) return false;
      const dt = DateTime.fromISO(d.date, { zone: config.timezone }).startOf('day');
      const diff = dt.diff(today, 'days').days;
      return dt.isValid && diff >= 0 && diff <= config.ddWindowDays;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      key: `dd:${d.project}:${d.label}:${d.date}`, source: 'deadline', category: 'deadline',
      title: `${d.project ? d.project + ': ' : ''}${d.label}`, detail: `Due ${d.date}`, link: '', due: d.date,
    }));
}

export function needsMeCards(rows: NeedsMe[]): NeedCard[] {
  return [...rows]
    .sort((a, b) => rank(SOURCE_ORDER, a.source) - rank(SOURCE_ORDER, b.source) || rank(CATEGORY_ORDER, a.category) - rank(CATEGORY_ORDER, b.category))
    .map((r) => ({ key: `needs:${r.id}`, id: r.id, source: r.source, category: r.category, title: r.title, detail: r.detail, link: r.link, due: r.due }));
}

/** Order: turnover waiting-on-me, DD deadlines, NeedsMe rows, then a drafts card when `drafts` is on. */
export function buildNeeds(args: { turnovers: TurnoverSummary; deadlines: Deadline[]; needsMe: NeedsMe[]; config: AppConfig; now: DateTime; draftsOn: boolean; proposedDrafts: number }): NeedCard[] {
  const cards = [...turnoverCards(args.turnovers), ...ddCards(args.deadlines, args.config, args.now), ...needsMeCards(args.needsMe)];
  if (args.draftsOn && args.proposedDrafts > 0) {
    cards.push({ key: 'drafts', source: 'drafts', category: 'other', title: `${args.proposedDrafts} draft${args.proposedDrafts === 1 ? '' : 's'} ready on your phone`, detail: '', link: '', due: '' });
  }
  return cards;
}
