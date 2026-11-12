'use server';
// Every mutation: a POST server action, owner-only, with an origin check. Each calls a guard first.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth/guards';
import { assertSameOrigin } from '@/lib/auth/origin';
import { callBridge } from '@/lib/bridge/client';
import { clearFeedCache } from '@/lib/bridge/feed';
import { SWITCH_NAMES, VIEW_NAMES } from '@/lib/feed/schema';

function done(path: string, error?: string): never {
  clearFeedCache();
  revalidatePath('/', 'layout');
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

export async function setSwitchAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const actor = await requireCapability('change_switches');
  const name = String(formData.get('name') ?? '');
  const on = formData.get('on') === 'true';
  if (!(SWITCH_NAMES as readonly string[]).includes(name)) done('/settings', 'unknown_switch');
  const res = await callBridge('setSwitch', { name, on, by: actor.email });
  done('/settings', res.ok ? undefined : res.error);
}

export async function setViewAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const actor = await requireCapability('approve_views');
  const view = String(formData.get('view') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!(VIEW_NAMES as readonly string[]).includes(view) || (status !== 'live' && status !== 'preview')) done('/settings', 'bad_request');
  const res = await callBridge('setView', { view, status, by: actor.email });
  done('/settings', res.ok ? undefined : res.error);
}

export async function dismissAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const actor = await requireCapability('dismiss_items');
  const id = String(formData.get('id') ?? '');
  if (!id) done('/', 'bad_request');
  const res = await callBridge('dismiss', { id, by: actor.email });
  done('/', res.ok ? undefined : res.error);
}

export async function decideDraftAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const actor = await requireCapability('decide_drafts');
  const draftId = String(formData.get('draftId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const hash = String(formData.get('hash') ?? '');
  if (!draftId || (decision !== 'approve' && decision !== 'reject')) done('/approvals', 'bad_request');
  const res = await callBridge('decide', { draftId, decision, hash, by: actor.email });
  if (!res.ok) done('/approvals', res.error);
  const url = String((res as any).data?.draftUrl ?? '');
  clearFeedCache();
  revalidatePath('/', 'layout');
  // With send_on_approve OFF, Approve opens the draft in Gmail for the owner to press Send there.
  if (decision === 'approve' && /^https:\/\//.test(url)) redirect(url);
  redirect('/approvals');
}

export async function signOutAction(): Promise<void> {
  await assertSameOrigin();
  await requireCapability('view_home');
  const { signOut } = await import('@/auth');
  await signOut({ redirectTo: '/signin' });
}
