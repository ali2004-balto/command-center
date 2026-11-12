// Loads the plain-JavaScript Bridge files in Node, with a tiny `Utilities` shim built on node:crypto.
import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';

const toSigned = (buf: Buffer) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));

(globalThis as any).Utilities = {
  computeHmacSha256Signature: (base: string, secret: string) => toSigned(createHmac('sha256', secret).update(base).digest()),
  computeDigest: (_alg: unknown, text: string) => toSigned(createHash('sha256').update(text, 'utf8').digest()),
  DigestAlgorithm: { SHA_256: 'sha256' },
  Charset: { UTF_8: 'utf8' },
  base64DecodeWebSafe: (s: string) => Array.from(Buffer.from(s, 'base64url')),
  newBlob: (bytes: number[]) => ({ getDataAsString: () => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b))).toString('utf8') }),
};

const req = createRequire(import.meta.url);
export const bridgePath = (f: string) => path.resolve(__dirname, '../../bridge/src', f);
export function loadBridge<T = any>(file: string): T {
  return req(bridgePath(file)) as T;
}
