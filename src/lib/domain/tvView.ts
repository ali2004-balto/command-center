// Applies R6: the TV board never shows email text, drafts, links, amounts, phone numbers, addresses, scope text or notes.
import type { Model } from './model';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|\b\d{10}\b/g;
const MONEY = /[$€£]\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM]\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:dollars|CAD|USD)\b/gi;

export function maskText(text: string): string {
  return text.replace(EMAIL, '[hidden]').replace(URL_RE, '[hidden]').replace(MONEY, '[hidden]').replace(PHONE, '[hidden]');
}

export interface TvView {
  greeting: string;
  dateText: string;
  timeText: string;
  bridgeDown: string | null;
  pill: { text: string; stale: boolean };
  turnoverPill: { text: string; stale: boolean };
  doneHeadline: string;
  done: string[];
  doneNotice: string;
  needsCount: number;
  needs: { title: string }[];
  needsMore: number;
  needsNotice: string;
  today: { time: string; title: string }[];
  todayNotice: string;
  stages: { label: string; count: number }[];
  overdue: number;
  blocked: number;
  metricsNotice: string;
  asOf: string;
  chips: { project: string; color: string; label: string }[];
  chipsMessage: string;
  demo: boolean;
}

export function toTvView(m: Model): TvView {
  const showTitles = m.config.tvShowEventTitles;
  return {
    greeting: m.greeting,
    dateText: m.dateText,
    timeText: m.timeText,
    bridgeDown: m.bridgeDown,
    pill: { text: m.morning.message, stale: m.morning.state === 'stale' },
    turnoverPill: { text: m.turnoverFresh.message, stale: m.turnoverFresh.state !== 'fresh' },
    doneHeadline: maskText(m.briefingHeadline),
    done: m.done.map(maskText),
    doneNotice: m.doneNotice,
    needsCount: m.needs.length,
    needs: m.needs.slice(0, 6).map((n) => ({ title: maskText(n.title) })),
    needsMore: Math.max(0, m.needs.length - 6),
    needsNotice: m.needsNotice,
    today: m.today.map((t) => ({ time: t.time, title: t.kind === 'event' && !showTitles ? 'Busy' : maskText(t.title) })),
    todayNotice: m.todayNotice,
    stages: m.turnovers.stageCounts.map((s) => ({ label: s.stage, count: s.count })),
    overdue: m.turnovers.overdue,
    blocked: m.turnovers.blocked,
    metricsNotice: m.turnoverFresh.state === 'bad' ? m.turnoverFresh.message : '',
    asOf: m.turnoverFresh.message,
    chips: (m.chips ?? []).map((c) => ({ project: maskText(c.project), color: c.color, label: maskText(`${c.nextLabel}${c.nextDate ? ' ' + c.nextDate : ''}`.trim()) })),
    chipsMessage: m.chipsMessage,
    demo: m.demo,
  };
}
