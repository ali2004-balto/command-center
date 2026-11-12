// /team (owner): needs the team_views switch and the team view to be live.
import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/auth/guards';
import { viewAccess } from '@/lib/domain/access';
import { loadModel } from '@/lib/load';
import Nav from '@/components/Nav';
import TeamView from '@/components/TeamView';
import s from '@/components/Home.module.css';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  await requireCapability('view_team');
  const m = await loadModel();
  const access = viewAccess(m, 'team', 'team_views', 'live');
  if (access === 'notFound') notFound();
  return (
    <main className={s.wrap}>
      <Nav model={m} />
      <h1>Team</h1>
      {access === 'notLive' ? <p>This view is not live yet</p> : <TeamView m={m} />}
    </main>
  );
}
