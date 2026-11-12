// Bridge pure logic: row helpers, housekeeping rules, extractDraftContent, decideDraftCore, build output.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadBridge } from './helpers/bridge';

const pure = loadBridge('pure.js');
const gmail = loadBridge('gmailSend.js');
const root = path.resolve(__dirname, '..');

describe('row helpers', () => {
  it('rowsToObjects pads, stringifies and skips empty rows', () => {
    const rows = pure.rowsToObjects(['a', 'b'], [['1'], [], ['', ''], [2, 'x']]);
    expect(rows).toEqual([{ a: '1', b: '' }, { a: '2', b: 'x' }]);
  });
  it('bytesToHex handles signed bytes', () => {
    expect(pure.bytesToHex([-1, 0, 127, -128])).toBe('ff007f80');
  });
  it('safeEqual', () => {
    expect(pure.safeEqual('abc', 'abc')).toBe(true);
    expect(pure.safeEqual('abc', 'abd')).toBe(false);
    expect(pure.safeEqual('abc', 'abcd')).toBe(false);
    expect(pure.safeEqual('abc', undefined)).toBe(false);
  });
});

describe('housekeeping deletion rule', () => {
  const cutoff = '2026-10-13';
  it('deletes old rows by date and keeps recent ones', () => {
    expect(pure.shouldDeleteRow('Heartbeat', { started_at: '2026-09-01T08:40:00-04:00', run_id: '' }, cutoff)).toBe(true);
    expect(pure.shouldDeleteRow('Heartbeat', { started_at: '2026-11-01T08:40:00-04:00', run_id: '' }, cutoff)).toBe(false);
    expect(pure.shouldDeleteRow('Projects', { run_id: '2026-09-01-morning-0840' }, cutoff)).toBe(true);
    expect(pure.shouldDeleteRow('Done', { at: '', run_id: '2026-11-10-morning-0840' }, cutoff)).toBe(false);
  });
  it('keeps unhandled manual NeedsMe rows however old, but deletes handled ones', () => {
    const base = { source: 'manual', run_id: '', created_at: '2026-01-01T09:00:00-05:00' };
    expect(pure.shouldDeleteRow('NeedsMe', { ...base, handled_at: '' }, cutoff)).toBe(false);
    expect(pure.shouldDeleteRow('NeedsMe', { ...base, handled_at: '2026-01-02T09:00:00-05:00' }, cutoff)).toBe(true);
  });
  it('keeps rows whose date cannot be told', () => {
    expect(pure.shouldDeleteRow('Deadlines', { run_id: '' }, cutoff)).toBe(false);
  });
});

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const decode = (s: string) => Buffer.from(s, 'base64url').toString('utf8');
const hdr = (o: Record<string, string>) => Object.entries(o).map(([name, value]) => ({ name, value }));

describe('extractDraftContent', () => {
  it('reads a single-part message', () => {
    const d = { message: { payload: { mimeType: 'text/plain', headers: hdr({ To: 'a@example.org', Subject: 'Hi' }), body: { data: b64('Hello') } } } };
    expect(gmail.extractDraftContent(d, decode)).toEqual({ to: 'a@example.org', cc: '', bcc: '', subject: 'Hi', body: 'Hello', attachments: 0 });
  });
  it('reads multipart/alternative and prefers text/plain', () => {
    const d = { message: { payload: { mimeType: 'multipart/alternative', headers: hdr({ To: 'a@example.org', Cc: 'c@example.org', Subject: 'S' }), parts: [{ mimeType: 'text/plain', body: { data: b64('plain') } }, { mimeType: 'text/html', body: { data: b64('<p>html</p>') } }] } } };
    const c = gmail.extractDraftContent(d, decode);
    expect(c.body).toBe('plain');
    expect(c.cc).toBe('c@example.org');
  });
  it('reads nested multipart/mixed and counts attachments', () => {
    const d = { message: { payload: { mimeType: 'multipart/mixed', headers: hdr({ to: 'a@example.org', bcc: 'hidden@example.org', subject: 'S' }), parts: [
      { mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: b64('nested') } }, { mimeType: 'text/html', body: { data: b64('x') } }] },
      { mimeType: 'application/pdf', filename: 'a.pdf', body: { attachmentId: 'att1', size: 10 } },
      { mimeType: 'image/png', filename: '', body: { attachmentId: 'att2' } },
    ] } } };
    const c = gmail.extractDraftContent(d, decode);
    expect(c).toMatchObject({ body: 'nested', attachments: 2, bcc: 'hidden@example.org' });
  });
  it('copes with an empty draft', () => {
    expect(gmail.extractDraftContent({}, decode)).toEqual({ to: '', cc: '', bcc: '', subject: '', body: '', attachments: 0 });
  });
});

describe('decideDraftCore (real Bridge logic with fakes)', () => {
  const content = { to: 'a@example.org', cc: '', bcc: '', subject: 'S', body: 'Body', attachments: 0 };
  const hashOf = (c: typeof content) => pure.sha256Hex(gmail.contentHashText(c));
  function make(over: Partial<Record<string, any>> = {}) {
    const calls = { send: vi.fn(), mark: vi.fn(), audit: vi.fn() };
    const deps = {
      switchOn: () => true, findProposed: () => true, readDraft: () => content, maxPerHour: () => 10, sentInLastHour: () => 0,
      send: calls.send, mark: calls.mark, audit: calls.audit, hash: pure.sha256Hex, ...over,
    };
    return { deps, calls };
  }
  it('sends once when everything matches', () => {
    const { deps, calls } = make();
    expect(gmail.decideDraftCore(deps, { draftId: 'd', hash: hashOf(content) })).toEqual({ status: 'sent' });
    expect(calls.send).toHaveBeenCalledTimes(1);
    expect(calls.mark).toHaveBeenCalledWith('d', { status: 'sent', content_hash: hashOf(content) });
  });
  it.each<[string, Record<string, any>, string, any?]>([
    ['a changed draft', { readDraft: () => ({ ...content, body: 'edited' }) }, 'changed'],
    ['an attachment', { readDraft: () => ({ ...content, attachments: 1 }) }, 'needs_gmail'],
    ['a Bcc', { readDraft: () => ({ ...content, bcc: 'x@example.org' }) }, 'needs_gmail', { ...content, bcc: 'x@example.org' }],
    ['the rate limit', { sentInLastHour: () => 10 }, 'rate_limited'],
    ['a row that is not proposed', { findProposed: () => false }, 'not_proposed'],
    ['the switch being off', { switchOn: () => false }, 'send_off'],
  ])('sends nothing for %s', (_n, over, code, seen) => {
    const { deps, calls } = make(over);
    // For "changed"/"needs_gmail" the hash the owner saw is that of the original content.
    expect(() => gmail.decideDraftCore(deps, { draftId: 'd', hash: hashOf((seen as any) ?? content) })).toThrow(code as string);
    expect(calls.send).not.toHaveBeenCalled();
  });
  it('a Gmail failure sets status=error and sends nothing further', () => {
    const { deps, calls } = make({ send: () => { throw new Error('boom'); } });
    expect(() => gmail.decideDraftCore(deps, { draftId: 'd', hash: hashOf(content) })).toThrow('send_failed');
    expect(calls.mark).toHaveBeenCalledWith('d', { status: 'error', error: 'send_failed' });
  });
});

describe('build output', () => {
  const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
  it('dist has no Gmail code; dist-send has it', () => {
    expect(read('bridge/dist/Code.gs')).not.toMatch(/Gmail\.Users|GmailApp|Drafts\.send/);
    expect(read('bridge/dist-send/Code.gs')).toMatch(/Gmail\.Users\.Drafts\.send/);
    expect(read('bridge/dist-send/Code.gs')).not.toMatch(/GmailApp/);
  });
  it('is current with the sources', async () => {
    const { execFileSync } = await import('node:child_process');
    const before = [read('bridge/dist/Code.gs'), read('bridge/dist-send/Code.gs')];
    execFileSync('node', ['bridge/build.mjs'], { cwd: root });
    expect([read('bridge/dist/Code.gs'), read('bridge/dist-send/Code.gs')]).toEqual(before);
  });
  it('manifests carry exactly the required scopes and settings', () => {
    const base = JSON.parse(read('bridge/dist/appsscript.json'));
    expect(base.oauthScopes).toEqual(['https://www.googleapis.com/auth/spreadsheets.currentonly', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/script.scriptapp']);
    expect(base.webapp).toEqual({ executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
    expect(base.runtimeVersion).toBe('V8');
    expect(base.timeZone).toBe('America/Toronto');
    const send = JSON.parse(read('bridge/dist-send/appsscript.json'));
    expect(send.oauthScopes).toContain('https://www.googleapis.com/auth/gmail.compose');
    expect(send.dependencies.enabledAdvancedServices[0]).toMatchObject({ userSymbol: 'Gmail', serviceId: 'gmail' });
  });
  it('starts with @OnlyCurrentDoc and never opens other spreadsheets', () => {
    const code = read('bridge/dist/Code.gs');
    expect(code.slice(0, 400)).toContain('@OnlyCurrentDoc');
    expect(code).not.toMatch(/openById|openByUrl/);
  });
  it('parses as JavaScript', () => {
    expect(() => new Function(read('bridge/dist/Code.gs'))).not.toThrow();
    expect(() => new Function(read('bridge/dist-send/Code.gs'))).not.toThrow();
  });
});
