// /preview/<view> (owner only): shows a view whose status is "preview", under a fixed banner.
import { notFound, redirect } from 'next/navigation';
import { requireCapability } from '@/lib/auth/guards';
import { viewAccess } from '@/lib/domain/access';
import { loadModel } from '@/lib/load';
import { loadLiveDrafts } from '@/lib/approvals';
import Nav from '@/components/Nav';
import TeamView from '@/components/TeamView';
import ApprovalsView from '@/components/ApprovalsView';
import s from '@/components/Home.module.css';

export const dynamic = 'force-dynamic';

const VIEWS: Record<string, { switchName: string; cap: 'view_team' | 'view_approvals'; title: string }> = {
  team: { switchName: 'team_views', cap: 'view_team', title: 'Team' },
  approvals: { switchName: 'drafts', cap: 'view_approvals', title: 'Approvals' },
};

export default async function PreviewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const def = VIEWS[view];
  if (!def) {
    await requireCapability('view_home');
    notFound();
  }
  await requireCapability(def.cap);
  const m = await loadModel();
  const access = viewAccess(m, view, def.switchName, 'preview');
  if (access === 'notFound') notFound();
  if (access === 'redirectLive') redirect(`/${view}`);
  return (
    <>
      <div className="preview-banner">PREVIEW: not live</div>
      <main className={s.wrap}>
        <Nav model={m} />
        <h1>{def.title}</h1>
        {view === 'team' ? <TeamView m={m} /> : <ApprovalsView m={m} {...(view === 'approvals' ? await loadLiveDrafts(m) : {})} />}
      </main>
    </>
  );
}
