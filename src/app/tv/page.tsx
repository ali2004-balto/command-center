// /tv: the private, display-only board. Requires the paired cookie (set by /tv?k=<key>). Reloads itself every 5 minutes.
import { cookies } from 'next/headers';
import { TV_COOKIE, tvCookieValid } from '@/lib/auth/tv';
import { loadModel } from '@/lib/load';
import { toTvView } from '@/lib/domain/tvView';
import TvBoard from '@/components/TvBoard';

export const dynamic = 'force-dynamic';

export default async function TvPage() {
  const jar = await cookies();
  const paired = tvCookieValid(jar.get(TV_COOKIE)?.value, process.env.TV_KEY, process.env.AUTH_SECRET);
  if (!paired) {
    return (
      <main style={{ background: '#0b1220', color: '#cbd5e1', minHeight: '100vh', padding: 40, fontSize: 28 }}>
        <p>This screen is not paired</p>
      </main>
    );
  }
  const view = toTvView(await loadModel());
  return (
    <>
      <meta httpEquiv="refresh" content="300" />
      <TvBoard v={view} />
    </>
  );
}
