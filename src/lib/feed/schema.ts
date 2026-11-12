// The single definition of the Feed tabs (name, ordered columns, description, writer).
// The Bridge setup(), validators, mock Bridge and morning-run prompt are built from or tested against this.

export interface TabDef {
  name: string;
  columns: string[];
  description: string;
  writtenBy: string;
  /** Append-only tabs: the Bridge returns only the last 200 rows. */
  appendOnly?: boolean;
}

export const FEED_TABS: TabDef[] = [
  { name: 'Switches', columns: ['switch', 'on', 'what_it_does', 'changed_at', 'changed_by'], description: 'Feature switches, all off by default.', writtenBy: "Bridge, on the owner's tap" },
  { name: 'Views', columns: ['view', 'status', 'changed_at', 'changed_by'], description: 'Whether a view is live or in preview.', writtenBy: "Bridge, on the owner's tap" },
  { name: 'Config', columns: ['key', 'value', 'note'], description: 'Settings the owner edits by hand.', writtenBy: 'the owner, by hand' },
  { name: 'Heartbeat', columns: ['job', 'run_id', 'started_at', 'finished_at', 'status', 'summary', 'counts'], description: 'One row at the start and one at the end of each run.', writtenBy: 'morning run', appendOnly: true },
  { name: 'Briefing', columns: ['run_id', 'generated_at', 'headline', 'covers_from', 'covers_to'], description: 'One-sentence briefing per run.', writtenBy: 'morning run', appendOnly: true },
  { name: 'Done', columns: ['run_id', 'at', 'text', 'detail', 'kind'], description: 'What the run did.', writtenBy: 'morning run', appendOnly: true },
  { name: 'NeedsMe', columns: ['id', 'run_id', 'source', 'category', 'title', 'detail', 'link', 'due', 'project', 'created_at', 'handled_at', 'handled_by'], description: 'Items that need the owner.', writtenBy: 'morning run and conversation; the Bridge fills handled_at and handled_by', appendOnly: true },
  { name: 'Projects', columns: ['run_id', 'project', 'where_it_stands', 'next_date', 'next_label', 'open_items', 'blocked', 'doc_link', 'as_of'], description: 'Project status chips.', writtenBy: 'morning run', appendOnly: true },
  { name: 'Deadlines', columns: ['run_id', 'project', 'label', 'date', 'kind', 'source'], description: 'Upcoming dated items.', writtenBy: 'morning run', appendOnly: true },
  { name: 'Drafts', columns: ['draft_id', 'run_id', 'thread_url', 'draft_url', 'to', 'subject', 'why', 'preview', 'created_at', 'status', 'decided_at', 'content_hash', 'error'], description: 'Proposed email drafts.', writtenBy: 'morning run; the Bridge updates status, decided_at, content_hash, error', appendOnly: true },
  { name: 'State', columns: ['key', 'value', 'updated_at'], description: 'Run memory (cursors).', writtenBy: 'morning run' },
  { name: 'TurnoverSnapshots', columns: ['date', 'property', 'unit', 'stage'], description: 'Daily copy of turnover stages.', writtenBy: 'Bridge daily trigger', appendOnly: true },
  { name: 'Audit', columns: ['at', 'actor', 'action', 'target', 'detail'], description: 'Every change made through the Bridge.', writtenBy: 'Bridge' },
  { name: 'TrackerMirror', columns: [], description: 'One IMPORTRANGE formula in A1: a live copy of the turnover tab.', writtenBy: 'Google' },
  { name: 'Yardi', columns: ['note'], description: 'Reserved for Yardi Voyager data.', writtenBy: 'nobody yet' },
];

export const TAB_NAMES = FEED_TABS.map((t) => t.name);

export function tabDef(name: string): TabDef {
  const t = FEED_TABS.find((x) => x.name === name);
  if (!t) throw new Error(`Unknown tab ${name}`);
  return t;
}

export function columnsOf(name: string): string[] {
  return tabDef(name).columns;
}

/** Tabs the morning run writes, in the order of the prompt. */
export const MORNING_RUN_TABS = ['Heartbeat', 'Briefing', 'Done', 'NeedsMe', 'Projects', 'Deadlines', 'Drafts', 'State'];

/** Tabs the Bridge `feed` action returns (everything except Audit). */
export const FEED_ACTION_TABS = TAB_NAMES.filter((n) => n !== 'Audit' && n !== 'TrackerMirror');

export const SWITCH_NAMES = ['team_views', 'email_triage', 'drafts', 'send_on_approve', 'yardi'] as const;
export type SwitchName = (typeof SWITCH_NAMES)[number];
export const VIEW_NAMES = ['tv', 'home', 'team', 'approvals'] as const;
export type ViewName = (typeof VIEW_NAMES)[number];
