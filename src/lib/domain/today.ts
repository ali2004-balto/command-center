// One time-ordered "Today" list: calendar events, turnovers due today, steps scheduled today, deadlines.
import { DateTime } from 'luxon';
import type { CalendarEventT, Deadline } from '../feed/validators';
import type { TurnoverSummary } from './turnovers';

export interface TodayItem { kind: 'event' | 'turnover' | 'step' | 'deadline'; time: string; title: string; allDay?: boolean }

export function buildToday(calendar: CalendarEventT[], turnovers: TurnoverSummary, deadlines: Deadline[], now: DateTime, zone = 'America/Toronto'): TodayItem[] {
  const todayStr = now.setZone(zone).toFormat('yyyy-MM-dd');
  const timed: { key: string; item: TodayItem }[] = [];
  for (const e of calendar) {
    const start = DateTime.fromISO(e.start, { zone });
    if (e.allDay || !start.isValid) timed.push({ key: '0000', item: { kind: 'event', time: 'All day', title: e.title, allDay: true } });
    else timed.push({ key: start.toFormat('HHmm'), item: { kind: 'event', time: start.toFormat('h:mm a'), title: e.title } });
  }
  for (const t of turnovers.today) timed.push({ key: '9998', item: { kind: t.kind, time: '', title: t.title } });
  for (const d of deadlines) if (d.date === todayStr) timed.push({ key: '9999', item: { kind: 'deadline', time: '', title: `${d.project ? d.project + ': ' : ''}${d.label}` } });
  return timed.sort((a, b) => a.key.localeCompare(b.key)).map((x) => x.item);
}
