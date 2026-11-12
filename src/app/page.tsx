// Home: the owner's phone-friendly version of the board, with detail and links.
import { requireCapability } from '@/lib/auth/guards';
import { loadModel } from '@/lib/load';
import HomePanels from '@/components/Panels';
import Nav from '@/components/Nav';
import s from '@/components/Home.module.css';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability('view_home');
  const { error } = await searchParams;
  const m = await loadModel();
  return (
    <main className={s.wrap}>
      <Nav model={m} />
      {error && <p className={s.err}>Something went wrong: {error}</p>}
      {m.bridgeDown ? (
        <p className={s.notice}>{m.bridgeDown}</p>
      ) : (
        <>
          <h1>{m.greeting}</h1>
          <p className={s.muted}>{m.dateText} · {m.timeText}</p>
          <HomePanels m={m} />
        </>
      )}
    </main>
  );
}
