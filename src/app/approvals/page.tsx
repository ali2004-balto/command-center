// /approvals (owner): needs the drafts switch and the approvals view to be live.
import { notFound } from 'next/navigation';
import { requireCapability } from '@/lib/auth/guards';
import { viewAccess } from '@/lib/domain/access';
import { loadModel } from '@/lib/load';
import { loadLiveDrafts } from '@/lib/approvals';
import Nav from '@/components/Nav';
import ApprovalsView from '@/components/ApprovalsView';
import s from '@/components/Home.module.css';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability('view_approvals');
  const { error } = await searchParams;
  const m = await loadModel();
  const access = viewAccess(m, 'approvals', 'drafts', 'live');
  if (access === 'notFound') notFound();
  return (
    <main className={s.wrap}>
      <Nav model={m} />
      <h1>Approvals</h1>
      {access === 'notLive' ? <p>This view is not live yet</p> : <ApprovalsView m={m} error={error} {...await loadLiveDrafts(m)} />}
    </main>
  );
}
