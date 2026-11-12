// Settings page body: switches, views, health, TV link help, Yardi placeholder.
import { setSwitchAction, setViewAction, signOutAction } from '@/app/actions';
import { SWITCH_NAMES, VIEW_NAMES } from '@/lib/feed/schema';
import type { Model } from '@/lib/domain/model';
import { getYardiData } from '@/lib/domain/yardi';
import s from './Home.module.css';

export default function SettingsView({ m, error, liveMode }: { m: Model; error?: string; liveMode: boolean }) {
  const hb = [...m.heartbeats].slice(-5).reverse();
  return (
    <>
      {error && <p className={s.err}>Not done: {error}</p>}
      <section className={s.card}>
        <h2>Switches</h2>
        {SWITCH_NAMES.map((name) => {
          const on = m.switches[name] === true;
          return (
            <details className={s.item} key={name}>
              <summary>{name}: <b>{on ? 'ON' : 'OFF'}</b></summary>
              <form action={setSwitchAction}>
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="on" value={on ? 'false' : 'true'} />
                <p>Turn {name} {on ? 'OFF' : 'ON'}?</p>
                <button className={`${s.btn} ${on ? s.danger : ''}`} type="submit">Yes, turn {on ? 'off' : 'on'}</button>
              </form>
            </details>
          );
        })}
      </section>

      <section className={s.card}>
        <h2>Views</h2>
        {VIEW_NAMES.map((v) => {
          const status = m.views[v] ?? 'preview';
          const gated = v === 'team' || v === 'approvals';
          return (
            <div className={s.item} key={v}>
              <b>{v}</b>: {status}
              {gated && <> · <a href={`/preview/${v}`}>Preview</a></>}
              {gated && (
                <form action={setViewAction}>
                  <input type="hidden" name="view" value={v} />
                  <input type="hidden" name="status" value={status === 'live' ? 'preview' : 'live'} />
                  <button className={s.btn} type="submit">{status === 'live' ? 'Unpublish (set preview)' : 'Approve (set live)'}</button>
                </form>
              )}
            </div>
          );
        })}
      </section>

      <section className={s.card}>
        <h2>Health</h2>
        <p>Mode: <b>{liveMode ? 'Live' : 'DEMO'}</b></p>
        <p>Bridge: <b>{m.bridgeDown ? 'NOT reachable' : 'reachable'}</b></p>
        <p>Last feed: {m.generatedAt || 'none'}</p>
        <p>Turnover copy: {m.turnoverFresh.message}</p>
        <p>Morning run: {m.morning.message}</p>
        {m.badTabs.map((b) => <p className={s.notice} key={b.tab}>BAD DATA in {b.tab}: {b.error}</p>)}
        {m.turnovers.problems.length > 0 && <details><summary>{m.turnovers.problems.length} turnover data problem(s)</summary>{m.turnovers.problems.map((p, i) => <p key={i}>{p}</p>)}</details>}
        {m.feedErrors.length > 0 && <p className={s.notice}>Bridge errors: {m.feedErrors.join(', ')}</p>}
        <table>
          <thead><tr><th>Run</th><th>Status</th><th>Summary</th></tr></thead>
          <tbody>{hb.map((h, i) => <tr key={i}><td>{h.run_id}</td><td>{h.status}</td><td>{h.summary}</td></tr>)}</tbody>
        </table>
      </section>

      <section className={s.card}>
        <h2>TV link</h2>
        <p>Open <code>/tv?k=&lt;TV_KEY&gt;</code> once on the TV; it remembers. To change the link, change <code>TV_KEY</code> in Vercel and redeploy.</p>
      </section>

      <section className={s.card} style={{ opacity: 0.55 }}>
        <h2>Yardi Voyager: not connected</h2>
        <p>{getYardiData() === null ? 'Reserved for later.' : ''}</p>
      </section>

      <form action={signOutAction}><button className={`${s.btn} ${s.plain}`} type="submit">Sign out</button></form>
    </>
  );
}
