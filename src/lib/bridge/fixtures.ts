// Invented demo data for mock mode and tests. No real company data lives here.
import { DateTime } from 'luxon';
import { FEED_TABS } from '../feed/schema';

export type Row = Record<string, string>;
export interface MockState {
  tabs: Record<string, Row[]>;
  tracker: string[][];
  calendar: { title: string; start: string; end: string; allDay: boolean }[];
  snapshot: { date: string; rows: { property: string; unit: string; stage: string }[] } | null;
  audit: Row[];
  /** Live Gmail content for each draft, used when send_on_approve is ON. */
  liveDrafts: Record<string, { to: string; cc: string; bcc: string; subject: string; body: string; attachments: number }>;
}

export const TRACKER_HEADINGS = [
  'Property', 'Unit', 'Move-out date', 'Target ready date', 'Current stage', 'Days vacant', 'Days in stage', 'Flag',
  'Inspection status', 'Inspection date', 'Scope status', 'Scope date', "Scope of work (what's required)", 'Work status', 'Work date',
  'Assigned to (employee)', 'Cleaning status', 'Cleaning date', 'Photos status', 'Photos date', 'Leasing status', 'Leasing date', 'Notes / blockers',
];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatStamp(d: DateTime): string {
  const h12 = d.hour % 12 === 0 ? 12 : d.hour % 12;
  return `From the Unit Turnover app (${MON[d.month - 1]} ${d.day}, ${d.year}, ${h12}:${String(d.minute).padStart(2, '0')} ${d.hour < 12 ? 'a.m.' : 'p.m.'}). Make changes in the app: this copy is replaced.`;
}

const STAGE_STEP: Record<string, number> = { '1. Inspection': 0, '2. Scope of work': 1, '3. In-house work': 2, '4. Cleaning': 3, '5. Photos': 4, '6. Leasing upload': 5 };

// property, unit, stage, flag, assigned, target offset (days from today), scope, notes
const UNITS: [string, string, string, string, string, number, string, string][] = [
  ['Maple Court', '12', '1. Inspection', 'On track', '', 9, '', ''],
  ['Maple Court', '14', '2. Scope of work', 'Due soon', '', 3, 'Replace vanity, patch drywall', ''],
  ['Maple Court', '21', '2. Scope of work', 'On track', '', 12, 'Paint and flooring', ''],
  ['Maple Court', '33', '3. In-house work', 'On track', 'Sam Example', 6, 'Paint, hardware swap', ''],
  ['Maple Court', '35', '3. In-house work', 'Overdue', 'Sam Example', -2, 'Full repaint', 'Waiting on paint order'],
  ['Cedar Place', '2A', '3. In-house work', 'Blocked', 'Pat Sample', 5, 'Replace fixtures', 'Part on back order'],
  ['Cedar Place', '2B', '3. In-house work', 'On track', '', 8, 'Touch-up paint', ''],
  ['Cedar Place', '3C', '4. Cleaning', 'On track', 'Pat Sample', 2, 'Deep clean', ''],
  ['Cedar Place', '4A', '4. Cleaning', 'Due soon', '', 0, 'Deep clean', ''],
  ['Birch Terrace', '101', '5. Photos', 'On track', '', 4, '', ''],
  ['Birch Terrace', '102', '5. Photos', 'On track', '', 5, '', ''],
  ['Birch Terrace', '204', '6. Leasing upload', 'Due soon', '', 1, '', 'Listing copy needed'],
  ['Birch Terrace', '205', '6. Leasing upload', 'On track', '', 7, '', ''],
  ['Birch Terrace', '301', '1. Inspection', 'No target date', '', -1000, '', ''],
  ['Cedar Place', '5D', '2. Scope of work', 'Overdue', '', -4, 'Bathroom refresh', ''],
  ['Maple Court', '40', '3. In-house work', 'On track', 'Pat Sample', 10, 'Carpet removal', ''],
  ['Birch Terrace', '110', 'Complete', 'Complete', '', 0, '', ''],
  ['Maple Court', '08', 'Complete', 'Complete', '', 0, '', ''],
];

export function makeTrackerGrid(nowIn: DateTime, stampIn?: DateTime): string[][] {
  const now = nowIn.setZone('America/Toronto');
  const stampAt = (stampIn ?? now.minus({ hours: 2 })).setZone('America/Toronto');
  const day = (offset: number) => now.plus({ days: offset }).toFormat('yyyy-MM-dd');
  const rows = UNITS.map(([property, unit, stage, flag, assigned, off, scope, notes]) => {
    const r = new Array(23).fill('');
    const idx = (h: string) => TRACKER_HEADINGS.indexOf(h);
    r[idx('Property')] = property;
    r[idx('Unit')] = unit;
    r[idx('Move-out date')] = day(-20);
    r[idx('Target ready date')] = off === -1000 ? '' : day(off);
    r[idx('Current stage')] = stage;
    r[idx('Days vacant')] = '20';
    r[idx('Days in stage')] = '3';
    r[idx('Flag')] = flag;
    r[idx("Scope of work (what's required)")] = scope;
    r[idx('Assigned to (employee)')] = assigned;
    r[idx('Notes / blockers')] = notes;
    const cur = STAGE_STEP[stage] ?? 6;
    const steps: [string, string][] = [['Inspection status', 'Inspection date'], ['Scope status', 'Scope date'], ['Work status', 'Work date'], ['Cleaning status', 'Cleaning date'], ['Photos status', 'Photos date'], ['Leasing status', 'Leasing date']];
    steps.forEach(([s, d], i) => {
      r[idx(s)] = i < cur ? 'Done' : i === cur ? (unit === '4A' || unit === '33' ? 'Scheduled' : 'In progress') : 'Not started';
      if (i === cur && (unit === '4A' || unit === '33')) r[idx(d)] = day(0);
    });
    return r;
  });
  const title = new Array(5).fill('');
  title[0] = 'Unit Turnover export';
  title[4] = formatStamp(stampAt);
  return [title, ['Unit', '', 'Dates'], TRACKER_HEADINGS, ...rows];
}

export function makeFixture(nowIn: DateTime): MockState {
  const now = nowIn.setZone('America/Toronto');
  const iso = (d: DateTime) => d.toISO({ suppressMilliseconds: true }) ?? '';
  const date = (d: DateTime) => d.toFormat('yyyy-MM-dd');
  const start = now.minus({ minutes: 70 });
  const runId = `${date(start)}-morning-${start.toFormat('HHmm')}`;
  const tabs: Record<string, Row[]> = {};
  for (const t of FEED_TABS) tabs[t.name] = [];
  const blank = (tab: string, over: Row): Row => {
    const r: Row = {};
    for (const c of FEED_TABS.find((t) => t.name === tab)!.columns) r[c] = over[c] ?? '';
    return r;
  };
  const sw = (switchName: string, what: string) => blank('Switches', { switch: switchName, on: 'FALSE', what_it_does: what });
  tabs.Switches = [
    sw('team_views', 'Show the Team page.'), sw('email_triage', 'Morning run sorts email.'), sw('drafts', 'Morning run writes drafts.'),
    sw('send_on_approve', 'Approve sends the draft.'), sw('yardi', 'Reserved for Yardi.'),
  ];
  tabs.Views = [['tv', 'live'], ['home', 'live'], ['team', 'preview'], ['approvals', 'preview']].map(([view, status]) => blank('Views', { view, status }));
  const cfg: [string, string][] = [
    ['owner_name', 'Sam Example'], ['timezone', 'America/Toronto'], ['my_stages', '2. Scope of work; 6. Leasing upload'],
    ['turnover_stale_hours', '72'], ['morning_due_time', '09:30'], ['morning_days', '1,2,3,4,5'], ['dd_window_days', '14'],
    ['work_projects', 'Project One; Project Two; Project Three'], ['tv_show_event_titles', 'TRUE'], ['max_sends_per_hour', '10'],
  ];
  tabs.Config = cfg.map(([key, value]) => blank('Config', { key, value }));
  tabs.Heartbeat = [
    blank('Heartbeat', { job: 'morning', run_id: runId, started_at: iso(start), status: 'running' }),
    blank('Heartbeat', { job: 'morning', run_id: runId, started_at: iso(start), finished_at: iso(start.plus({ minutes: 12 })), status: 'ok', summary: 'Demo run', counts: '{"needs":2}' }),
  ];
  tabs.Briefing = [blank('Briefing', { run_id: runId, generated_at: iso(start.plus({ minutes: 12 })), headline: 'Sorted 14 emails: 2 need you, 2 drafts are ready, and your only meeting is at 2 pm.', covers_from: iso(start.minus({ hours: 24 })), covers_to: iso(start) })];
  tabs.Done = [
    blank('Done', { run_id: runId, at: iso(start), text: 'Sorted 14 new emails', detail: '2 need you, 2 simple, 10 FYI', kind: 'email' }),
    blank('Done', { run_id: runId, at: iso(start), text: 'Prepared 2 draft replies', detail: '', kind: 'drafts' }),
  ];
  tabs.NeedsMe = [
    blank('NeedsMe', { id: 'email:t-100', run_id: runId, source: 'email', category: 'legal', title: 'Legal: open the thread', link: 'https://mail.example.com/thread/t-100', created_at: iso(start) }),
    blank('NeedsMe', { id: 'email:t-101', run_id: runId, source: 'email', category: 'pricing', title: 'Contractor quote for Maple Court roof', detail: 'Sam Example asks for approval of the roof quote.', link: 'https://mail.example.com/thread/t-101', created_at: iso(start) }),
    blank('NeedsMe', { id: 'manual:call-vendor', run_id: '', source: 'manual', category: 'other', title: 'Call the vendor about the boiler', created_at: iso(start) }),
  ];
  tabs.Projects = [
    blank('Projects', { run_id: runId, project: 'Project One', where_it_stands: 'Waiting on permits.', next_date: date(now.plus({ days: 3 })), next_label: 'Permit decision', open_items: '2', blocked: 'FALSE', doc_link: 'https://docs.example.com/p1', as_of: date(now.minus({ days: 2 })) }),
    blank('Projects', { run_id: runId, project: 'Project Two', where_it_stands: 'On schedule.', next_date: date(now.plus({ days: 20 })), next_label: 'Closing', open_items: '0', blocked: 'FALSE', doc_link: 'https://docs.example.com/p2', as_of: date(now.minus({ days: 2 })) }),
    blank('Projects', { run_id: runId, project: 'Project Three', where_it_stands: 'Blocked on a decision.', next_date: date(now.minus({ days: 1 })), next_label: 'Offer reply', open_items: '3', blocked: 'TRUE', doc_link: 'https://docs.example.com/p3', as_of: date(now.minus({ days: 2 })) }),
  ];
  tabs.Deadlines = [
    blank('Deadlines', { run_id: runId, project: 'Project One', label: 'Due diligence: environmental review', date: date(now.plus({ days: 5 })), kind: 'dd', source: 'status-doc' }),
    blank('Deadlines', { run_id: runId, project: 'Project Two', label: 'Closing', date: date(now.plus({ days: 20 })), kind: 'closing', source: 'status-doc' }),
  ];
  tabs.Drafts = [
    blank('Drafts', { draft_id: 'd-1', run_id: runId, thread_url: 'https://mail.example.com/thread/t-200', draft_url: 'https://mail.example.com/draft/d-1', to: 'vendor@example.org', subject: 'Re: Tuesday access', why: 'Simple yes to a time request.', preview: 'Hi, Tuesday at 10 works. Thanks.', created_at: iso(start), status: 'proposed' }),
    blank('Drafts', { draft_id: 'd-2', run_id: runId, thread_url: 'https://mail.example.com/thread/t-201', draft_url: 'https://mail.example.com/draft/d-2', to: 'contractor@example.org', subject: 'Re: Invoice received', why: 'Acknowledgement.', preview: 'Thanks, received.', created_at: iso(start), status: 'proposed' }),
    blank('Drafts', { draft_id: 'd-0', run_id: '2026-01-01-morning-0840', thread_url: '', draft_url: 'https://mail.example.com/draft/d-0', to: 'old@example.org', subject: 'Re: Old thing', why: '', preview: 'Ok.', created_at: '2026-01-01T08:50:00-05:00', status: 'rejected', decided_at: '2026-01-01T09:00:00-05:00' }),
  ];
  tabs.State = [blank('State', { key: 'last_run_at', value: iso(start), updated_at: iso(start) })];
  tabs.Yardi = [blank('Yardi', { note: 'Not connected.' })];

  const at = (h: number, m: number) => now.set({ hour: h, minute: m, second: 0, millisecond: 0 });
  const grid = makeTrackerGrid(now);
  const snap = UNITS.map(([property, unit, stage]) => ({ property, unit, stage }));
  snap[3] = { ...snap[3], stage: '2. Scope of work' }; // Maple Court 33 moved since yesterday
  snap[7] = { ...snap[7], stage: '3. In-house work' }; // Cedar Place 3C moved since yesterday
  return {
    tabs,
    tracker: grid,
    calendar: [
      { title: 'Site walk with Pat Sample', start: iso(at(10, 0)), end: iso(at(11, 0)), allDay: false },
      { title: 'Budget review call', start: iso(at(14, 0)), end: iso(at(14, 30)), allDay: false },
      { title: 'Office closed (holiday)', start: iso(at(0, 0)), end: iso(at(23, 59)), allDay: true },
    ],
    snapshot: { date: date(now.minus({ days: 1 })), rows: snap },
    audit: [],
    liveDrafts: {
      'd-1': { to: 'vendor@example.org', cc: '', bcc: '', subject: 'Re: Tuesday access', body: 'Hi, Tuesday at 10 works. Thanks.', attachments: 0 },
      'd-2': { to: 'contractor@example.org', cc: '', bcc: '', subject: 'Re: Invoice received', body: 'Thanks, received.', attachments: 0 },
    },
  };
}
