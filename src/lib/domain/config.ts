// Turns the Config tab into a typed object with safe defaults.
export interface AppConfig {
  ownerName: string;
  timezone: string;
  myStages: string[];
  turnoverStaleHours: number;
  morningDueTime: string; // HH:mm
  morningDays: number[]; // 1 = Monday
  ddWindowDays: number;
  workProjects: string[];
  tvShowEventTitles: boolean;
  maxSendsPerHour: number;
  raw: Record<string, string>;
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return v !== undefined && v.trim() !== '' && isFinite(n) ? n : d;
}
function list(v: string | undefined, sep: string, d: string[]): string[] {
  if (v === undefined || v.trim() === '') return d;
  return v.split(sep).map((s) => s.trim()).filter(Boolean);
}

export function parseConfig(rows: { key: string; value: string }[], appTimezone = 'America/Toronto'): AppConfig {
  const raw: Record<string, string> = {};
  for (const r of rows) raw[r.key] = r.value;
  const due = /^\d{1,2}:\d{2}$/.test((raw.morning_due_time ?? '').trim()) ? raw.morning_due_time.trim() : '09:30';
  return {
    ownerName: raw.owner_name?.trim() || 'there',
    timezone: raw.timezone?.trim() || appTimezone,
    myStages: list(raw.my_stages, ';', ['2. Scope of work', '6. Leasing upload']),
    turnoverStaleHours: num(raw.turnover_stale_hours, 72),
    morningDueTime: due,
    morningDays: list(raw.morning_days, ',', ['1', '2', '3', '4', '5']).map(Number).filter((n) => n >= 1 && n <= 7),
    ddWindowDays: num(raw.dd_window_days, 14),
    workProjects: list(raw.work_projects, ';', []),
    tvShowEventTitles: (raw.tv_show_event_titles ?? 'TRUE').trim().toUpperCase() !== 'FALSE',
    maxSendsPerHour: num(raw.max_sends_per_hour, 10),
    raw,
  };
}
