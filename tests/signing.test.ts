// The app's signer against the Bridge's verifyRequest.
import { describe, expect, it } from 'vitest';
import { signRequest } from '@/lib/bridge/sign';
import { loadBridge } from './helpers/bridge';

const { verifyRequest } = loadBridge('pure.js');
const SECRET = 'test-secret-value';

describe('signing round trip', () => {
  it('accepts a good request', () => {
    const body = signRequest('ping', { a: 1 }, SECRET);
    const v = verifyRequest(body, SECRET, Date.now(), null);
    expect(v).toEqual({ ok: true, action: 'ping', payload: { a: 1 } });
  });
  it('rejects the wrong secret', () => {
    expect(verifyRequest(signRequest('ping', {}, SECRET), 'other', Date.now(), null)).toEqual({ ok: false, error: 'bad_signature' });
  });
  it('rejects a tampered payload and action', () => {
    const body = signRequest('setSwitch', { name: 'drafts', on: false }, SECRET);
    expect(verifyRequest({ ...body, payload: JSON.stringify({ name: 'drafts', on: true }) }, SECRET, Date.now(), null).ok).toBe(false);
    expect(verifyRequest({ ...body, action: 'decide' }, SECRET, Date.now(), null).ok).toBe(false);
  });
  it('rejects an expired timestamp and a wrong version', () => {
    const body = signRequest('ping', {}, SECRET, Date.now() - 10 * 60 * 1000);
    expect(verifyRequest(body, SECRET, Date.now(), null)).toEqual({ ok: false, error: 'stale_request' });
    expect(verifyRequest({ ...signRequest('ping', {}, SECRET), v: 2 }, SECRET, Date.now(), null)).toEqual({ ok: false, error: 'bad_version' });
  });
  it('rejects a replayed nonce', () => {
    const seen = new Set<string>();
    const seenNonce = (n: string) => (seen.has(n) ? true : (seen.add(n), false));
    const body = signRequest('dismiss', { id: 'x' }, SECRET);
    expect(verifyRequest(body, SECRET, Date.now(), seenNonce).ok).toBe(true);
    expect(verifyRequest(body, SECRET, Date.now(), seenNonce)).toEqual({ ok: false, error: 'replay' });
  });
  it('uses 24 hex nonce characters and a hex signature', () => {
    const body = signRequest('ping', {}, SECRET);
    expect(body.nonce).toMatch(/^[0-9a-f]{24}$/);
    expect(body.sig).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof body.payload).toBe('string');
  });
});
