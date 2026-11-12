// The Feed schema is the single definition; the Bridge's tab list must match it.
import { describe, expect, it } from 'vitest';
import { FEED_TABS, columnsOf } from '@/lib/feed/schema';
import { loadBridge } from './helpers/bridge';

describe('feed schema', () => {
  it('lists every tab with exact column order', () => {
    expect(FEED_TABS.map((t) => t.name)).toEqual(['Switches', 'Views', 'Config', 'Heartbeat', 'Briefing', 'Done', 'NeedsMe', 'Projects', 'Deadlines', 'Drafts', 'State', 'TurnoverSnapshots', 'Audit', 'TrackerMirror', 'Yardi']);
    expect(columnsOf('Switches')).toEqual(['switch', 'on', 'what_it_does', 'changed_at', 'changed_by']);
    expect(columnsOf('NeedsMe')).toEqual(['id', 'run_id', 'source', 'category', 'title', 'detail', 'link', 'due', 'project', 'created_at', 'handled_at', 'handled_by']);
    expect(columnsOf('Drafts')).toEqual(['draft_id', 'run_id', 'thread_url', 'draft_url', 'to', 'subject', 'why', 'preview', 'created_at', 'status', 'decided_at', 'content_hash', 'error']);
    expect(columnsOf('Projects')).toEqual(['run_id', 'project', 'where_it_stands', 'next_date', 'next_label', 'open_items', 'blocked', 'doc_link', 'as_of']);
    expect(columnsOf('Heartbeat')).toEqual(['job', 'run_id', 'started_at', 'finished_at', 'status', 'summary', 'counts']);
  });

  it('is identical to the Bridge tab definitions', () => {
    const { TABS } = loadBridge('tabs.js');
    expect(TABS.map((t: any) => ({ name: t.name, columns: t.columns }))).toEqual(FEED_TABS.map((t) => ({ name: t.name, columns: t.columns })));
  });
});
