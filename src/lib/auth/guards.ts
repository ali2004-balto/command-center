// Server-side guards. Every owner page, server action and route handler must call one of these first (R4).
import { redirect } from 'next/navigation';
import { can, type Capability } from './roles';
import { getActor, type Actor } from './session';

export class AccessDenied extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AccessDenied';
  }
}

export async function requireOwner(): Promise<Actor> {
  const actor = await getActor();
  if (!actor || actor.role !== 'owner') redirect('/signin');
  return actor;
}

export async function requireCapability(cap: Capability): Promise<Actor> {
  const actor = await requireOwner();
  if (!can(actor.role, cap)) throw new AccessDenied(`Missing capability ${cap}`);
  return actor;
}
