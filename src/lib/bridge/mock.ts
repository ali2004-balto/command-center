// In-memory mock of the Bridge: the same actions as the Apps Script, over fixture data. Used in demo mode and tests.
import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import { makeFixture, type MockState, type Row } from './fixtures';

export type BridgeResult = { ok: true; data: any } | { ok: false; error: string };

export interface MockBridge {
  state: MockState;
  handle(action: string, payload: any): Promise<BridgeResult>;
  /** Everything "sent" through the mock, so tests can prove nothing else was sent. */
  sent: string[];
  options: { sendInstalled: boolean };
}

const ok = (data: unknown): BridgeResult => ({ ok: true, data });
const err = (error: string): BridgeResult => ({ ok: false, error });

export function hashDraft(c: { to: string; cc: string; bcc: string; subject: string; body: string }): string {
  return createHash('sha256').update([c.to, c.cc, c.bcc, c.subject, c.body].join('\n')).digest('hex');
}

export function createMockBridge(now: DateTime = DateTime.now(), clock: () => number = () => Date.now()): MockBridge {
  const state = makeFixture(now);
  const sent: string[] = [];
  const options = { sendInstalled: true };
  const stamp = () => DateTime.fromMillis(clock()).setZone('America/Toronto').toISO({ suppressMilliseconds: true }) ?? '';
  const audit = (action: string, target: string, detail: string, actor = 'owner') =>
    state.audit.push({ at: stamp(), actor, action, target, detail });
  const switchOn = (name: string) => state.tabs.Switches.some((r) => r.switch === name && r.on === 'TRUE');
  const draftRow = (id: string): Row | undefined => state.tabs.Drafts.find((r) => r.draft_id === id);

  async function handle(action: string, p: any): Promise<BridgeResult> {
    switch (action) {
      case 'ping':
        return ok({ time: stamp() });
      case 'feed': {
        const tabs: Record<string, Row[]> = {};
        for (const [k, v] of Object.entries(state.tabs)) if (k !== 'Audit' && k !== 'TrackerMirror' && k !== 'TurnoverSnapshots') tabs[k] = v.map((r) => ({ ...r }));
        return ok({ generatedAt: stamp(), tabs, tracker: state.tracker, calendar: state.calendar, snapshot: state.snapshot, errors: [] });
      }
      case 'setSwitch': {
        const row = state.tabs.Switches.find((r) => r.switch === p?.name);
        if (!row) return err('unknown_switch');
        row.on = p.on === true ? 'TRUE' : 'FALSE';
        row.changed_at = stamp();
        row.changed_by = p.by ?? 'owner';
        audit('setSwitch', p.name, row.on, p.by);
        return ok({ switches: state.tabs.Switches.map((r) => ({ ...r })) });
      }
      case 'setView': {
        const row = state.tabs.Views.find((r) => r.view === p?.view);
        if (!row) return err('unknown_view');
        if (p.status !== 'live' && p.status !== 'preview') return err('bad_status');
        row.status = p.status;
        row.changed_at = stamp();
        row.changed_by = p.by ?? 'owner';
        audit('setView', p.view, p.status, p.by);
        return ok({ views: state.tabs.Views.map((r) => ({ ...r })) });
      }
      case 'dismiss': {
        const rows = state.tabs.NeedsMe.filter((r) => r.id === p?.id);
        if (!rows.length) return err('not_found');
        for (const r of rows) { r.handled_at = stamp(); r.handled_by = p.by ?? 'owner'; }
        audit('dismiss', p.id, String(rows.length), p.by);
        return ok({ id: p.id });
      }
      case 'drafts': {
        if (!options.sendInstalled) return err('send_not_installed');
        const drafts = state.tabs.Drafts.filter((r) => r.status === 'proposed').map((r) => {
          const c = state.liveDrafts[r.draft_id];
          if (!c) return { draftId: r.draft_id, error: 'unreadable' };
          return { draftId: r.draft_id, to: c.to, cc: c.cc, subject: c.subject, body: c.body, hash: hashDraft(c), attachments: c.attachments, hasBcc: !!c.bcc };
        });
        return ok({ drafts });
      }
      case 'decide': {
        if (p?.decision !== 'approve' && p?.decision !== 'reject') return err('bad_decision');
        const row = draftRow(p.draftId);
        if (!row || row.status !== 'proposed') return err('not_proposed');
        if (p.decision === 'reject') {
          row.status = 'rejected'; row.decided_at = stamp();
          audit('draft_rejected', p.draftId, '', p.by);
          return ok({ status: 'rejected' });
        }
        if (!switchOn('send_on_approve')) {
          row.status = 'opened'; row.decided_at = stamp();
          audit('draft_opened', p.draftId, '', p.by);
          return ok({ status: 'opened', draftUrl: row.draft_url });
        }
        if (!options.sendInstalled) return err('send_not_installed');
        const c = state.liveDrafts[p.draftId];
        if (!c) return err('unreadable');
        if (hashDraft(c) !== p.hash) { audit('draft_refused', p.draftId, 'changed', p.by); return err('changed'); }
        if (c.attachments > 0 || c.bcc) { audit('draft_refused', p.draftId, 'needs_gmail', p.by); return err('needs_gmail'); }
        const max = Number(state.tabs.Config.find((r) => r.key === 'max_sends_per_hour')?.value) || 10;
        const recent = state.audit.filter((a) => a.action === 'draft_sent' && DateTime.fromISO(a.at).toMillis() > clock() - 3600000).length;
        if (recent >= max) { audit('draft_refused', p.draftId, 'rate_limited', p.by); return err('rate_limited'); }
        sent.push(p.draftId);
        row.status = 'sent'; row.decided_at = stamp(); row.content_hash = p.hash;
        audit('draft_sent', p.draftId, '', p.by);
        return ok({ status: 'sent' });
      }
      default:
        return err('unknown_action');
    }
  }
  return { state, handle, sent, options };
}

const g = globalThis as unknown as { __mockBridge?: MockBridge };
/** One shared mock for the running process, so demo clicks stick until restart. */
export function getMockBridge(): MockBridge {
  if (!g.__mockBridge) g.__mockBridge = createMockBridge();
  return g.__mockBridge;
}
export function resetMockBridge(): void {
  delete g.__mockBridge;
}
