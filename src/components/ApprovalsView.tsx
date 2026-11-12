// Approvals page body: proposed drafts with Approve, Reject and Open in Gmail, plus the last 20 decided.
import { decideDraftAction } from '@/app/actions';
import type { Model } from '@/lib/domain/model';
import type { LiveDraft } from '@/lib/approvals';
import s from './Home.module.css';

export default function ApprovalsView({ m, error, live = {}, liveError = '' }: { m: Model; error?: string; live?: Record<string, LiveDraft>; liveError?: string }) {
  const proposed = m.drafts.filter((d) => d.status === 'proposed');
  const decided = m.drafts.filter((d) => d.status !== 'proposed').sort((a, b) => b.decided_at.localeCompare(a.decided_at)).slice(0, 20);
  const sendOn = m.switches.send_on_approve === true;
  return (
    <>
      {error && <p className={s.err}>Not done: {error}</p>}
      {liveError && <p className={s.notice}>Could not read drafts from Gmail ({liveError}). Use Open in Gmail instead.</p>}
      <p className={s.muted}>{sendOn ? 'Approve sends the draft exactly as shown.' : 'Approve opens the draft in Gmail. You press Send there; this app sends nothing.'}</p>
      {proposed.length === 0 && <p className={s.muted}>No drafts waiting</p>}
      {proposed.map((d) => {
        const l = live[d.draft_id];
        const canSend = sendOn && l && !l.error && l.hash;
        return (
          <section className={s.card} key={d.draft_id}>
            <h2>{l?.subject ?? d.subject}</h2>
            <p>To: {l?.to ?? d.to}</p>
            <p className={s.muted}>Why: {d.why}</p>
            <pre className={s.pre}>{l && !l.error ? l.body : d.preview}</pre>
            {sendOn && l && (l.attachments || l.hasBcc) ? <p className={s.notice}>Has an attachment or Bcc: send it from Gmail.</p> : null}
            <form action={decideDraftAction}>
              <input type="hidden" name="draftId" value={d.draft_id} />
              <input type="hidden" name="hash" value={canSend ? l.hash : ''} />
              {(!sendOn || canSend) && <button className={s.btn} name="decision" value="approve" type="submit">Approve</button>}
              <button className={`${s.btn} ${s.danger}`} name="decision" value="reject" type="submit">Reject</button>
              {d.draft_url && /^https:\/\//.test(d.draft_url) && <a className={s.btn} style={{ textDecoration: 'none', display: 'inline-block' }} href={d.draft_url} rel="noreferrer">Open in Gmail</a>}
            </form>
          </section>
        );
      })}
      <section className={s.card}>
        <h2>Recently decided</h2>
        {decided.length === 0 && <p className={s.muted}>Nothing yet</p>}
        {decided.map((d) => (
          <p key={d.draft_id}>{d.subject}: <b>{d.status}</b> {d.decided_at.slice(0, 16).replace('T', ' ')}{d.error ? ` (${d.error})` : ''}</p>
        ))}
      </section>
    </>
  );
}
