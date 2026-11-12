// Origin check for every mutation: the request must come from this site's own pages.
import { headers } from 'next/headers';
import { AccessDenied } from './guards';

export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!origin || !host) throw new AccessDenied('Missing origin');
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AccessDenied('Bad origin');
  }
  if (originHost !== host) throw new AccessDenied('Cross-site request refused');
}
