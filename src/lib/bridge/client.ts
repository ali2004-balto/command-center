// Calls the Bridge: signed HTTPS POST in live mode, the in-memory mock otherwise.
import { getMode } from '../env';
import { getMockBridge, type BridgeResult } from './mock';
import { signRequest } from './sign';
import { BridgeEnvelope } from '../feed/validators';

export async function callBridge(action: string, payload: unknown = {}): Promise<BridgeResult> {
  if (getMode() === 'mock') return getMockBridge().handle(action, payload);
  const url = process.env.BRIDGE_URL;
  const secret = process.env.BRIDGE_SECRET;
  if (!url || !secret) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(signRequest(action, payload, secret)),
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, error: 'http_error' };
    const parsed = BridgeEnvelope.safeParse(await res.json());
    if (!parsed.success) return { ok: false, error: 'bad_response' };
    return parsed.data.ok ? { ok: true, data: parsed.data.data } : { ok: false, error: parsed.data.error };
  } catch {
    return { ok: false, error: 'unreachable' };
  }
}
