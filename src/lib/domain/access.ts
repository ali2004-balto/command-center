// Switch and view gating, decided on the server.
import type { Model } from './model';

export type Access = 'show' | 'notFound' | 'notLive' | 'redirectLive';

/** `via` is how the page was reached: its live route or /preview/<view>. */
export function viewAccess(m: Pick<Model, 'switches' | 'views'>, view: string, switchName: string | null, via: 'live' | 'preview'): Access {
  if (switchName && m.switches[switchName] !== true) return 'notFound';
  const status = m.views[view] ?? 'preview';
  if (via === 'live') return status === 'live' ? 'show' : 'notLive';
  return status === 'preview' ? 'show' : 'redirectLive';
}
