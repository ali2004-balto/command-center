// Panels shared by the phone Home page.
import type { Model } from '@/lib/domain/model';
import { dismissAction } from '@/app/actions';
import s from './Home.module.css';

export function Notice({ text }: { text: string }) {
  return text ? <p className={s.notice}>{text}</p> : null;
}

export default function HomePanels({ m }: { m: Model }) {
  const t = m.turnovers;
  return (
    <>
      <div className={s.card}>
        <span className={m.morning.state === 'stale' ? s.notice : s.ok}>{m.morning.message}</span>
      </div>

      <section className={s.card}>
        <h2>Done overnight</h2>
        <Notice text={m.doneNotice} />
        {m.briefingHeadline && <p><b>{m.briefingHeadline}</b></p>}
        {m.done.map((d, i) => <p key={i}>{d}</p>)}
      </section>

      <section className={s.card}>
        <h2>Needs you ({m.needs.length})</h2>
        <Notice text={m.needsNotice} />
        {m.needs.length === 0 && <p className={s.muted}>Nothing needs you right now</p>}
        {m.needs.map((n) => (
          <details className={s.item} key={n.key}>
            <summary>{n.title}</summary>
            {n.detail && <p>{n.detail}</p>}
            {n.due && <p className={s.muted}>Due {n.due}</p>}
            {n.link && /^https:\/\//.test(n.link) && <p><a href={n.link} rel="noreferrer">Open</a></p>}
            {n.id && (
              <form action={dismissAction}>
                <input type="hidden" name="id" value={n.id} />
                <button className={`${s.btn} ${s.plain}`} type="submit">Dismiss</button>
              </form>
            )}
          </details>
        ))}
      </section>

      <section className={s.card}>
        <h2>Today</h2>
        <Notice text={m.todayNotice} />
        {m.today.length === 0 && <p className={s.muted}>Nothing scheduled</p>}
        {m.today.map((e, i) => <p key={i}>{e.time && <b>{e.time} </b>}{e.title}</p>)}
      </section>

      <section className={s.card}>
        <h2>Turnovers</h2>
        {m.turnoverFresh.state === 'bad' ? <Notice text={m.turnoverFresh.message} /> : (
          <>
            <p className={m.turnoverFresh.state === 'stale' ? s.notice : s.muted}>{m.turnoverFresh.message}</p>
            <div className={s.counters}>
              {t.stageCounts.map((c) => <div className={s.counter} key={c.stage}><b>{c.count}</b>{c.stage}</div>)}
            </div>
            <p><b style={{ color: '#b91c1c' }}>Overdue {t.overdue}</b> · <b style={{ color: '#b91c1c' }}>Blocked {t.blocked}</b> · Due soon {t.dueSoon}</p>
            {t.problems.length > 0 && <p className={s.muted}>{t.problems.length} data problem(s) in the copy</p>}
          </>
        )}
      </section>

      <section className={s.card}>
        <h2>Projects</h2>
        {m.chipsMessage && <p className={m.chips ? s.notice : s.muted}>{m.chipsMessage}</p>}
        {(m.chips ?? []).map((c) => (
          <details className={s.item} key={c.project}>
            <summary><span className={`${s.chip} ${s[c.color]}`}>{c.project}</span> {c.nextLabel} {c.nextDate}</summary>
            <p>{c.whereItStands}</p>
            {c.docLink && /^https:\/\//.test(c.docLink) && <p><a href={c.docLink} rel="noreferrer">Status doc</a></p>}
          </details>
        ))}
        {m.chipsAsOf && <p className={s.muted}>Status docs as of {m.chipsAsOf}</p>}
      </section>
    </>
  );
}
