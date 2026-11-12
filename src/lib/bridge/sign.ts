// Signs Bridge requests: HMAC-SHA256 over ts, nonce, action and payload, joined with newlines.
import { createHmac, randomBytes } from 'node:crypto';

export interface SignedBody { v: 1; action: string; payload: string; ts: string; nonce: string; sig: string }

export function signRequest(action: string, payload: unknown, secret: string, nowMs = Date.now(), nonce = randomBytes(12).toString('hex')): SignedBody {
  const payloadStr = JSON.stringify(payload ?? {});
  const ts = String(Math.floor(nowMs / 1000));
  const sig = createHmac('sha256', secret).update([ts, nonce, action, payloadStr].join('\n')).digest('hex');
  return { v: 1, action, payload: payloadStr, ts, nonce, sig };
}
