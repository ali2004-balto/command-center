// Part 4 against the mock Bridge: approve with send off opens Gmail only; send on needs the hash and the rules.
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { hashDraft } from '@/lib/bridge/mock';
import { freshBridge, NOW } from './helpers/model';

const sendOn = (b: ReturnType<typeof freshBridge>, on = 'TRUE') => (b.state.tabs.Switches.find((r) => r.switch === 'send_on_approve')!.on = on);
const row = (b: ReturnType<typeof freshBridge>, id: string) => b.state.tabs.Drafts.find((r) => r.draft_id === id)!;
const hashFor = (b: ReturnType<typeof freshBridge>, id: string) => hashDraft(b.state.liveDrafts[id]);

describe('send_on_approve OFF', () => {
  it('approve opens the draft in Gmail and sends nothing', async () => {
    const b = freshBridge();
    const r = await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash: '', by: 'owner@example.com' });
    expect(r).toEqual({ ok: true, data: { status: 'opened', draftUrl: 'https://mail.example.com/draft/d-1' } });
    expect(row(b, 'd-1').status).toBe('opened');
    expect(b.sent).toEqual([]);
    expect(b.state.audit).toEqual([expect.objectContaining({ action: 'draft_opened', target: 'd-1' })]);
  });
  it('reject sets rejected, writes Audit, and keeps the draft', async () => {
    const b = freshBridge();
    expect((await b.handle('decide', { draftId: 'd-2', decision: 'reject' })).ok).toBe(true);
    expect(row(b, 'd-2')).toMatchObject({ status: 'rejected' });
    expect(row(b, 'd-2').draft_url).not.toBe('');
    expect(b.state.audit[0]).toMatchObject({ action: 'draft_rejected' });
    expect(b.sent).toEqual([]);
  });
});

describe('send_on_approve ON', () => {
  it('sends exactly once with a matching hash, and records status and hash', async () => {
    const b = freshBridge();
    sendOn(b);
    const hash = hashFor(b, 'd-1');
    expect(await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash })).toEqual({ ok: true, data: { status: 'sent' } });
    expect(row(b, 'd-1')).toMatchObject({ status: 'sent', content_hash: hash });
    expect(b.sent).toEqual(['d-1']);
    // A second approve of the same draft is refused: it is no longer proposed.
    expect(await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash })).toEqual({ ok: false, error: 'not_proposed' });
    expect(b.sent).toEqual(['d-1']);
  });
  it('the drafts action returns live content and a hash', async () => {
    const b = freshBridge();
    sendOn(b);
    const r = await b.handle('drafts', {});
    expect(r.ok && r.data.drafts[0]).toMatchObject({ draftId: 'd-1', body: 'Hi, Tuesday at 10 works. Thanks.', hash: hashFor(b, 'd-1') });
  });
  it('refuses a mismatched hash', async () => {
    const b = freshBridge();
    sendOn(b);
    const stale = hashFor(b, 'd-1');
    b.state.liveDrafts['d-1'].body = 'changed after you looked';
    expect(await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash: stale })).toEqual({ ok: false, error: 'changed' });
    expect(b.sent).toEqual([]);
    expect(row(b, 'd-1').status).toBe('proposed');
  });
  it('refuses an attachment or a Bcc', async () => {
    const b = freshBridge();
    sendOn(b);
    b.state.liveDrafts['d-1'].attachments = 1;
    expect(await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash: hashFor(b, 'd-1') })).toEqual({ ok: false, error: 'needs_gmail' });
    b.state.liveDrafts['d-2'].bcc = 'x@example.org';
    expect(await b.handle('decide', { draftId: 'd-2', decision: 'approve', hash: hashFor(b, 'd-2') })).toEqual({ ok: false, error: 'needs_gmail' });
    expect(b.sent).toEqual([]);
  });
  it('enforces the hourly limit', async () => {
    const b = freshBridge();
    sendOn(b);
    b.state.tabs.Config.find((r) => r.key === 'max_sends_per_hour')!.value = '1';
    expect((await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash: hashFor(b, 'd-1') })).ok).toBe(true);
    expect(await b.handle('decide', { draftId: 'd-2', decision: 'approve', hash: hashFor(b, 'd-2') })).toEqual({ ok: false, error: 'rate_limited' });
    expect(b.sent).toEqual(['d-1']);
  });
  it('refuses a draft that is not proposed', async () => {
    const b = freshBridge();
    sendOn(b);
    expect(await b.handle('decide', { draftId: 'd-0', decision: 'approve', hash: 'x' })).toEqual({ ok: false, error: 'not_proposed' });
    expect(b.sent).toEqual([]);
  });
  it('answers send_not_installed when the Gmail build is not installed', async () => {
    const b = freshBridge();
    sendOn(b);
    b.options.sendInstalled = false;
    expect(await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash: hashFor(b, 'd-1') })).toEqual({ ok: false, error: 'send_not_installed' });
    expect(b.sent).toEqual([]);
  });
  it('an old send in the audit log no longer counts after an hour', async () => {
    let t = NOW.toMillis();
    const b = (await import('@/lib/bridge/mock')).createMockBridge(NOW, () => t);
    sendOn(b as any);
    b.state.tabs.Config.find((r) => r.key === 'max_sends_per_hour')!.value = '1';
    await b.handle('decide', { draftId: 'd-1', decision: 'approve', hash: hashDraft(b.state.liveDrafts['d-1']) });
    t += 3_700_000;
    expect((await b.handle('decide', { draftId: 'd-2', decision: 'approve', hash: hashDraft(b.state.liveDrafts['d-2']) })).ok).toBe(true);
    expect(DateTime.fromMillis(t).isValid).toBe(true);
  });
});
