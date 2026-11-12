// Simple top navigation for owner pages.
import Link from 'next/link';
import s from './Home.module.css';

export default function Nav({ model }: { model?: { switches: Record<string, boolean>; views: Record<string, string> } }) {
  return (
    <div className={s.nav}>
      <Link href="/">Home</Link>
      {model?.switches.team_views && <Link href={model.views.team === 'live' ? '/team' : '/preview/team'}>Team</Link>}
      {model?.switches.drafts && <Link href={model.views.approvals === 'live' ? '/approvals' : '/preview/approvals'}>Approvals</Link>}
      <Link href="/settings">Settings</Link>
    </div>
  );
}
