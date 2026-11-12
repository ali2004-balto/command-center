// Project chips: red when blocked or overdue, amber when due within 7 days, green otherwise.
import { DateTime } from 'luxon';
import type { Project } from '../feed/validators';

export interface ProjectChip { project: string; color: 'red' | 'amber' | 'green'; nextLabel: string; nextDate: string; whereItStands: string; docLink: string; asOf: string; openItems: string }

export function chipColor(p: Pick<Project, 'blocked' | 'next_date'>, now: DateTime, zone = 'America/Toronto'): 'red' | 'amber' | 'green' {
  const today = now.setZone(zone).startOf('day');
  if (p.blocked === 'TRUE') return 'red';
  if (p.next_date) {
    const d = DateTime.fromISO(p.next_date, { zone }).startOf('day');
    if (d.isValid) {
      if (d < today) return 'red';
      if (d.diff(today, 'days').days <= 7) return 'amber';
    }
  }
  return 'green';
}

export function buildChips(projects: Project[], now: DateTime, zone = 'America/Toronto'): ProjectChip[] {
  return projects.map((p) => ({
    project: p.project, color: chipColor(p, now, zone), nextLabel: p.next_label, nextDate: p.next_date,
    whereItStands: p.where_it_stands, docLink: p.doc_link, asOf: p.as_of, openItems: p.open_items,
  }));
}
