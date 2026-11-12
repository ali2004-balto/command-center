// Parses the TrackerMirror grid (row 1 title and stamp, row 2 groups, row 3 headings, data from row 4).
import { DateTime } from 'luxon';
import { stampToInstant } from './stamp';

export const STAGES = ['1. Inspection', '2. Scope of work', '3. In-house work', '4. Cleaning', '5. Photos', '6. Leasing upload'] as const;
export const COMPLETE = 'Complete';

export type StepKey = 'inspection' | 'scope' | 'work' | 'cleaning' | 'photos' | 'leasing';
export const STEP_LABELS: Record<StepKey, string> = {
  inspection: 'Inspection', scope: 'Scope of work', work: 'In-house work', cleaning: 'Cleaning', photos: 'Photos', leasing: 'Leasing upload',
};
const STEP_HEADINGS: Record<StepKey, [string, string]> = {
  inspection: ['Inspection status', 'Inspection date'],
  scope: ['Scope status', 'Scope date'],
  work: ['Work status', 'Work date'],
  cleaning: ['Cleaning status', 'Cleaning date'],
  photos: ['Photos status', 'Photos date'],
  leasing: ['Leasing status', 'Leasing date'],
};

export interface Unit {
  property: string;
  unit: string;
  moveOut: string;
  targetReady: string;
  stage: string;
  daysVacant: string;
  daysInStage: string;
  flag: string;
  scopeOfWork: string;
  assignedTo: string;
  notes: string;
  steps: Record<StepKey, { status: string; date: string }>;
}

export type TrackerParsed =
  | { ok: true; stamp: DateTime | null; stampText: string; units: Unit[]; problems: string[] }
  | { ok: false; reason: string };

const REQUIRED = ['Property', 'Unit', 'Current stage', 'Target ready date', 'Flag', 'Assigned to (employee)'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTracker(grid: string[][], zone = 'America/Toronto'): TrackerParsed {
  if (!grid || grid.length < 3) return { ok: false, reason: 'Turnover copy unavailable' };
  const a1 = String(grid[0]?.[0] ?? '');
  if (/^#(REF|N\/A|ERROR|VALUE|NAME|NUM|DIV)/i.test(a1) || /^(Error|Loading)/i.test(a1)) return { ok: false, reason: 'Turnover copy unavailable' };
  const head = (grid[2] ?? []).map((h) => String(h ?? '').trim());
  const idx = (name: string) => head.indexOf(name);
  for (const r of REQUIRED) if (idx(r) < 0) return { ok: false, reason: 'Turnover copy unavailable' };
  const problems: string[] = [];
  const get = (row: string[], name: string) => {
    const i = idx(name);
    return i < 0 ? '' : String(row[i] ?? '').trim();
  };
  const date = (row: string[], name: string, label: string) => {
    const v = get(row, name);
    if (v === '') return '';
    if (DATE_RE.test(v)) return v;
    problems.push(`${label}: "${v}" is not a date (${name})`);
    return '';
  };
  const units: Unit[] = [];
  for (let r = 3; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const property = get(row, 'Property');
    const unit = get(row, 'Unit');
    if (!property && !unit) continue;
    const label = `${property} ${unit}`.trim();
    const steps = {} as Unit['steps'];
    (Object.keys(STEP_HEADINGS) as StepKey[]).forEach((k) => {
      steps[k] = { status: get(row, STEP_HEADINGS[k][0]), date: date(row, STEP_HEADINGS[k][1], label) };
    });
    units.push({
      property, unit,
      moveOut: date(row, 'Move-out date', label),
      targetReady: date(row, 'Target ready date', label),
      stage: get(row, 'Current stage'),
      daysVacant: get(row, 'Days vacant'),
      daysInStage: get(row, 'Days in stage'),
      flag: get(row, 'Flag'),
      scopeOfWork: get(row, "Scope of work (what's required)"),
      assignedTo: get(row, 'Assigned to (employee)'),
      notes: get(row, 'Notes / blockers'),
      steps,
    });
  }
  const stampText = String(grid[0]?.[4] ?? '');
  return { ok: true, stamp: stampToInstant(stampText, zone), stampText, units, problems };
}
