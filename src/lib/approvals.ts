// Reads the live Gmail content of proposed drafts through the Bridge (only when send_on_approve is ON).
import { callBridge } from './bridge/client';
import type { Model } from './domain/model';

export interface LiveDraft { draftId: string; to?: string; cc?: string; subject?: string; body?: string; hash?: string; attachments?: number; hasBcc?: boolean; error?: string }

export async function loadLiveDrafts(m: Pick<Model, 'switches'>): Promise<{ live: Record<string, LiveDraft>; liveError: string }> {
  if (m.switches.send_on_approve !== true) return { live: {}, liveError: '' };
  const res = await callBridge('drafts', {});
  if (!res.ok) return { live: {}, liveError: res.error };
  return { live: Object.fromEntries((res.data.drafts as LiveDraft[]).map((d) => [d.draftId, d])), liveError: '' };
}
