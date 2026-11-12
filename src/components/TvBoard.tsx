// The TV board. Server-rendered, no client JavaScript. Shows only what toTvView allows.
import type { TvView } from '@/lib/domain/tvView';
import s from './Tv.module.css';

export default function TvBoard({ v }: { v: TvView }) {
  if (v.bridgeDown) {
    return (
      <div className={s.board}>
        <div className={s.full}>{v.bridgeDown}</div>
      </div>
    );
  }
  return (
    <div className={s.board}>
      <div className={s.header}>
        <div>
          <h1 className={s.greeting}>{v.greeting}</h1>
          <p className={s.sub}>{v.dateText} · {v.timeText}</p>
        </div>
        <div className={s.pills}>
          <span className={`${s.pill} ${v.pill.stale ? s.stale : ''}`}>{v.pill.text}</span>
        </div>
      </div>

      <div className={s.main}>
        <section className={s.panel}>
          <h2>Done overnight</h2>
          {v.doneNotice && <p className={s.notice}>{v.doneNotice}</p>}
          {v.doneHeadline && <p className={s.headline}>{v.doneHeadline}</p>}
          {v.done.map((d, i) => (
            <p className={s.line} key={i}>{d}</p>
          ))}
        </section>

        <section className={s.panel}>
          <h2>
            Needs you <span className={s.badge}>{v.needsCount}</span>
          </h2>
          {v.needsNotice && <p className={s.notice}>{v.needsNotice}</p>}
          {v.needs.length === 0 && <p className={s.muted}>Nothing needs you right now</p>}
          {v.needs.map((n, i) => (
            <div className={s.card} key={i}>{n.title}</div>
          ))}
          {v.needsMore > 0 && <p className={s.more}>+{v.needsMore} more on your phone</p>}
        </section>

        <section className={s.panel}>
          <h2>Today</h2>
          {v.todayNotice && <p className={s.notice}>{v.todayNotice}</p>}
          {v.today.length === 0 && <p className={s.muted}>Nothing scheduled</p>}
          {v.today.map((t, i) => (
            <p className={s.event} key={i}>
              {t.time && <span className={s.time}>{t.time}</span>}
              {t.title}
            </p>
          ))}
        </section>
      </div>

      <section className={s.strip}>
        {v.metricsNotice ? (
          <p className={s.notice}>{v.metricsNotice}</p>
        ) : (
          <>
            <div className={s.counters}>
              {v.stages.map((st) => (
                <div className={s.counter} key={st.label}>
                  <span className={s.n}>{st.count}</span>
                  <span className={s.l}>{st.label}</span>
                </div>
              ))}
            </div>
            <div className={s.alerts}>
              <span className={s.red}>Overdue {v.overdue}</span>
              <span className={s.red}>Blocked {v.blocked}</span>
              <span className={`${s.pill} ${v.turnoverPill.stale ? s.stale : ''}`}>{v.asOf}</span>
            </div>
          </>
        )}
        <div className={s.chips}>
          {v.chips.length === 0 && <span className={s.muted}>{v.chipsMessage}</span>}
          {v.chipsMessage && v.chips.length > 0 && <p className={s.notice}>{v.chipsMessage}</p>}
          {v.chips.map((c, i) => (
            <span className={`${s.chip} ${s[c.color]}`} key={i}>
              {c.project}{c.label ? `: ${c.label}` : ''}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
