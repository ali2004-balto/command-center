// The TV board, "Numbers first" layout. Server-rendered, no client JavaScript. Shows only what toTvView allows.
import type { TvView } from '@/lib/domain/tvView';
import s from './Tv.module.css';

function Header({ v }: { v: TvView }) {
  return (
    <div className={s.header}>
      <div>
        <h1 className={s.greeting}>{v.greeting}</h1>
        <p className={s.sub}>{v.dateText} · {v.timeText}</p>
      </div>
      <span className={`${s.pill} ${v.pill.stale ? s.stale : ''}`}>{v.pill.text}</span>
    </div>
  );
}

export default function TvBoard({ v }: { v: TvView }) {
  if (v.bridgeDown) {
    return (
      <div className={s.board}>
        <div className={s.full}>{v.bridgeDown}</div>
      </div>
    );
  }

  const maxCount = Math.max(1, ...v.stages.map((st) => st.count));
  return (
    <div className={s.board}>
      <Header v={v} />

      <div className={s.top}>
        <div className={s.rail}>
          <section className={`${s.panel} ${s.hero}`}>
            <span className={s.heroNum}>{v.needsCount}</span>
            <div className={s.heroLabel}>Need you</div>
          </section>
          <section className={`${s.panel} ${s.alerts}`}>
            {v.metricsNotice ? (
              <p className={s.staleSmall}>{v.metricsNotice}</p>
            ) : (
              <>
                <span className={`${s.alert} ${v.overdue > 0 ? s.alertHot : ''}`}>{v.overdue}<span className={s.alertLabel}>Overdue</span></span>
                <span className={`${s.alert} ${v.blocked > 0 ? s.alertHot : ''}`}>{v.blocked}<span className={s.alertLabel}>Blocked</span></span>
              </>
            )}
          </section>
          <section className={`${s.panel} ${s.dates}`}>
            <h2>Coming up</h2>
            {v.chips.length === 0 && <span className={s.muted}>{v.chipsMessage}</span>}
            {v.chipsMessage && v.chips.length > 0 && <p className={s.notice}>{v.chipsMessage}</p>}
            {v.chips.map((c, i) => (
              <span className={`${s.chip} ${s[c.color] ?? s.green}`} key={i}>
                {c.project}{c.label ? `: ${c.label}` : ''}
              </span>
            ))}
          </section>
        </div>

        <section className={`${s.panel} ${s.needs}`}>
          <h2>Needs you</h2>
          {v.needsNotice && <p className={s.notice}>{v.needsNotice}</p>}
          {v.needs.length === 0 && <p className={s.muted}>Nothing needs you right now</p>}
          {v.needs.map((n, i) => (
            <div className={s.needRow} key={i}>
              <span className={s.rank}>{i + 1}</span>
              <span className={s.clamp2}>{n.title}</span>
            </div>
          ))}
          {v.needsMore > 0 && <p className={s.more}>+{v.needsMore} more on your phone</p>}
        </section>

        <section className={`${s.panel} ${s.done}`}>
          <h2>Done overnight</h2>
          {v.doneNotice && <p className={s.notice}>{v.doneNotice}</p>}
          {v.doneHeadline && <p className={s.headline}>{v.doneHeadline}</p>}
          {v.done.map((d, i) => (
            <p className={s.line} key={i}>{d}</p>
          ))}
        </section>
      </div>

      <div className={s.bottom}>
        <section className={`${s.panel} ${s.stages}`}>
          {v.metricsNotice ? (
            <div className={s.staleBanner}>
              <div className={s.staleTitle}>DATA IS STALE</div>
              <div className={s.staleMsg}>{v.metricsNotice}</div>
            </div>
          ) : (
            <>
              <h2>Turnovers by stage</h2>
              <div className={s.asOf}>
                <span className={`${s.pill} ${v.turnoverPill.stale ? s.stale : ''}`}>{v.asOf}</span>
              </div>
              <div className={s.bars}>
                {v.stages.map((st) => (
                  <div className={s.bar} key={st.label}>
                    <span className={s.barNum}>{st.count}</span>
                    <span className={s.barFill} style={{ height: `calc(${Math.round((st.count / maxCount) * 36)} * var(--u))` }} />
                    <span className={s.barLabel}>{st.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className={`${s.panel} ${s.today}`}>
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
    </div>
  );
}
