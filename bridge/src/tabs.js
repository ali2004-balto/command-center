// The Feed tab definitions. Kept equal to src/lib/feed/schema.ts by a test.
var TABS = [
  { name: 'Switches', columns: ['switch', 'on', 'what_it_does', 'changed_at', 'changed_by'] },
  { name: 'Views', columns: ['view', 'status', 'changed_at', 'changed_by'] },
  { name: 'Config', columns: ['key', 'value', 'note'] },
  { name: 'Heartbeat', columns: ['job', 'run_id', 'started_at', 'finished_at', 'status', 'summary', 'counts'], appendOnly: true },
  { name: 'Briefing', columns: ['run_id', 'generated_at', 'headline', 'covers_from', 'covers_to'], appendOnly: true },
  { name: 'Done', columns: ['run_id', 'at', 'text', 'detail', 'kind'], appendOnly: true },
  { name: 'NeedsMe', columns: ['id', 'run_id', 'source', 'category', 'title', 'detail', 'link', 'due', 'project', 'created_at', 'handled_at', 'handled_by'], appendOnly: true },
  { name: 'Projects', columns: ['run_id', 'project', 'where_it_stands', 'next_date', 'next_label', 'open_items', 'blocked', 'doc_link', 'as_of'], appendOnly: true },
  { name: 'Deadlines', columns: ['run_id', 'project', 'label', 'date', 'kind', 'source'], appendOnly: true },
  { name: 'Drafts', columns: ['draft_id', 'run_id', 'thread_url', 'draft_url', 'to', 'subject', 'why', 'preview', 'created_at', 'status', 'decided_at', 'content_hash', 'error'], appendOnly: true },
  { name: 'State', columns: ['key', 'value', 'updated_at'] },
  { name: 'TurnoverSnapshots', columns: ['date', 'property', 'unit', 'stage'], appendOnly: true },
  { name: 'Audit', columns: ['at', 'actor', 'action', 'target', 'detail'] },
  { name: 'TrackerMirror', columns: [] },
  { name: 'Yardi', columns: ['note'] }
];

if (typeof module !== 'undefined') module.exports = { TABS: TABS };
