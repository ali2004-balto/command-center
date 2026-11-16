// The TV board, "Numbers first" layout. Server-rendered, no client JavaScript. Shows only what toTvView allows.
import type { TvView } from '@/lib/domain/tvView';
import s from './Tv.module.css';

function Header({ v, pillText, stale }: { v: TvView; pillText: string; stale: boolean }) {
  return (
    <div className={s.header}>
      <div>
        <h1 className={s.greeting}>{v.greeting}</h1>
        <p className={s.sub}>{v.dateText} · {v.timeText}</p>
      </div>
      <span className={`${s.pill} ${stale ? s.stale : ''}`}>{pillText}</span>
    </div>
  );
}

export default function TvBoard({ v }: { v: TvView }) {
  // A failed or late run, or a bridge outage: one banner replaces every number.
  const reason = v.bridgeDown ?? (v.pill.stale ? v.pill.text : v.metricsNotice);
  if (reason) {
    return (
      <div className={s.board}>
        <Header v={v} pillText={v.bridgeDown ? 'Stale' : v.pill.text} stale />
        <div className={s.staleWrap}>
          <div className={s.staleAge}>
            <div className={s.staleAgeBig}>Old</div>
            <div className={s.staleAgeSub}>{reason}</div>
          </div>
          <div className={s.staleBanner}>
            <div className={s.staleTitle}>DATA IS STALE</div>
            <div className={s.staleMsg}>The morning run did not finish. Nothing on this board is current, so it is hidden.</div>
            <div className={s.staleHint}>Open the phone view for the last known list, or re-run the morning job.</div>
          </div>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(1, ...v.stages.map((st) => st.count));
  return (
    <div className={s.board}>
      <Header v={v} pillText={v.pill.text} stale={v.pill.stale} />

      <div className={s.top}>
        <div className={s.rail}>
          <section className={`${s.panel} ${s.hero}`}>
            <span className={s.heroNum}>{v.needsCount}</span>
            <div className={s.heroLabel}>Need you</div>
          </section>
          <section className={`${s.panel} ${s.alerts}`}>
            <span className={`${s.alert} ${v.overdue > 0 ? s.alertHot : ''}`}>{v.overdue}<span className={s.alertLabel}>Overdue</span></span>
            <span className={`${s.alert} ${v.blocked > 0 ? s.alertHot : ''}`}>{v.blocked}<span className={s.alertLabel}>Blocked</span></span>
          </section>
          <section className={`${s.panel} ${s.dates}`}>
            <h2>Coming up</h2>
            {v.chips.length === 0 && <span className={s.muted}>{v.chipsMessage}</span>}
            {v.chips.slice(0, 3).map((c, i) => (
              <span className={`${s.chip} ${s[c.color] ?? s.green}`} key={i}>
                {c.project}{c.label ? `: ${c.label}` : ''}
              </span>
            ))}
          </section>
        </div>

        <section className={`${s.panel} ${s.needs}`}>
          <h2>Needs you · most urgent first</h2>
          {v.needsNotice && <p className={s.notice}>{v.needsNotice}</p>}
          {v.needs.length === 0 && <p className={s.muted}>Nothing needs you right now</p>}
          {v.needs.map((n, i) => (
            <div className={s.needRow} key={i}>
              <span className={s.rank}>{i + 1}</span>
              {n.title}
            </div>
          ))}
          {v.needsMore > 0 && <p className={s.more}>+{v.needsMore} more on your phone</p>}
        </section>

        <section className={`${s.panel} ${s.done}`}>
          <h2>Done overnight</h2>
          {v.doneNotice && <p className={s.notice}>{v.doneNotice}</p>}
          {v.doneHeadline && <p className={s.headline}>{v.doneHeadline}</p>}
          {v.done.slice(0, 5).map((d, i) => (
            <p className={s.line} key={i}>{d}</p>
          ))}
        </section>
      </div>

      <div className={s.bottom}>
        <section className={`${s.panel} ${s.stages}`}>
          <h2>Turnovers by stage</h2>
          <div className={s.asOf}>
            <span className={`${s.pill} ${v.turnoverPill.stale ? s.stale : ''}`}>{v.asOf}</span>
          </div>
          <div className={s.bars}>
            {v.stages.map((st) => (
              <div className={s.bar} key={st.label}>
                <span className={s.barNum}>{st.count}</span>
                <span className={s.barFill} style={{ height: Math.round((st.count / maxCount) * 96) }} />
                <span className={s.barLabel}>{st.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`${s.panel} ${s.today}`}>
          <h2>Today</h2>
          {v.todayNotice && <p className={s.notice}>{v.todayNotice}</p>}
          {v.today.length === 0 && <p className={s.muted}>Nothing scheduled</p>}
          {v.today.slice(0, 4).map((t, i) => (
            <p className={s.event} key={i}>
              <span className={s.time}>{t.time}</span>
              {t.title}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}
