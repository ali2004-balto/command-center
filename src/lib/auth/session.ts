// Who is making this request? Only the signed-in owner counts. A TV cookie never makes anyone an owner.
import { isDevelopment, isMock, ownerEmails } from '@/lib/env';
import type { Role } from './roles';

export interface Actor { role: Role; email: string; demo?: boolean }

/** The fixed demo owner exists only in development, in mock mode (R10). Never in production. */
export function demoActor(): Actor | null {
  return isDevelopment() && isMock() ? { role: 'owner', email: 'demo-owner@example.com', demo: true } : null;
}

export async function getActor(): Promise<Actor | null> {
  const demo = demoActor();
  if (demo) return demo;
  const { auth } = await import('@/auth');
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  const domain = (process.env.ALLOWED_DOMAIN ?? '').trim().toLowerCase();
  if (!email || !domain || !email.endsWith('@' + domain)) return null;
  // Re-check on every request, so removing an address from OWNER_EMAILS takes effect at once.
  if (!ownerEmails().includes(email)) return null;
  return { role: 'owner', email };
}
