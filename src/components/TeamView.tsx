// Team page body: each employee's active in-house jobs, plus all active units by stage.
import type { Model } from '@/lib/domain/model';
import { shortStage } from '@/lib/domain/turnovers';
import s from './Home.module.css';

export default function TeamView({ m }: { m: Model }) {
  const t = m.turnovers;
  if (!t.ok) return <p className={s.notice}>{m.turnoverFresh.message}</p>;
  return (
    <>
      <p className={m.turnoverFresh.state === 'fresh' ? s.muted : s.notice}>{m.turnoverFresh.message}</p>
      {t.perPerson.length === 0 && <p className={s.muted}>No in-house jobs right now</p>}
      {t.perPerson.map((g) => (
        <section className={s.card} key={g.person}>
          <h2>{g.person} ({g.units.length})</h2>
          <table>
            <thead><tr><th>Unit</th><th>Work</th><th>Days</th><th>Scope</th></tr></thead>
            <tbody>
              {g.units.map((u) => (
                <tr key={`${u.property}${u.unit}`}>
                  <td>{u.property} {u.unit}</td>
                  <td>{u.steps.work.status || '-'}</td>
                  <td>{u.daysInStage || '-'}</td>
                  <td>{u.scopeOfWork || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <section className={s.card}>
        <h2>All active units by stage</h2>
        <table>
          <thead><tr><th>Stage</th><th>Unit</th><th>Flag</th></tr></thead>
          <tbody>
            {t.active.map((u) => (
              <tr key={`${u.property}${u.unit}`}>
                <td>{shortStage(u.stage)}</td><td>{u.property} {u.unit}</td><td>{u.flag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
