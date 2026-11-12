// Parses the "(Nov 11, 2026, 7:43 p.m.)" stamp in the turnover copy. The stamp is Toronto wall-clock time.
import { DateTime } from 'luxon';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseAppStamp(cellText: string | undefined | null) {
  const m = /\(([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?\)/i.exec(String(cellText || ''));
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  let hour = Number(m[4]) % 12;
  if (m[6].toLowerCase() === 'p') hour += 12;
  return { year: Number(m[3]), month: month + 1, day: Number(m[2]), hour, minute: Number(m[5]) };
}

/** The stamp as an instant (Toronto wall clock). Null when missing or invalid. */
export function stampToInstant(cellText: string | undefined | null, zone = 'America/Toronto'): DateTime | null {
  const p = parseAppStamp(cellText);
  if (!p) return null;
  const dt = DateTime.fromObject(p, { zone });
  return dt.isValid ? dt : null;
}
