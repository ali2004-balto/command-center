// Builds everything the screens show from one Bridge feed. Pure: pass in `now`.
import { DateTime } from 'luxon';
import { parseTab, type Draft, type FeedDataT, type Heartbeat } from '../feed/validators';
import { SWITCH_NAMES, VIEW_NAMES } from '../feed/schema';
import { parseConfig, type AppConfig } from './config';
import { bridgeDownMessage, latestOkRunId, morningFreshness, turnoverFreshness, type Freshness, type TurnoverFreshness } from './freshness';
import { buildNeeds, type NeedCard } from './needs';
import { buildChips, type ProjectChip } from './projects';
import { buildToday, type TodayItem } from './today';
import { parseTracker } from './tracker';
import { summarizeTurnovers, type TurnoverSummary } from './turnovers';

export type ViewStatus = 'live' | 'preview';

export interface Model {
  config: AppConfig;
  demo: boolean;
  nowIso: string;
  greeting: string;
  dateText: string;
  timeText: string;
  /** Full-screen message when the Bridge is unreachable, else null. */
  bridgeDown: string | null;
  morning: Freshness;
  turnoverFresh: TurnoverFreshness;
  briefingHeadline: string;
  done: string[];
  doneNotice: string;
  needs: NeedCard[];
  needsNotice: string;
  today: TodayItem[];
  todayNotice: string;
  turnovers: TurnoverSummary;
  chips: ProjectChip[] | null;
  chipsMessage: string;
  chipsAsOf: string;
  switches: Record<string, boolean>;
  views: Record<string, ViewStatus>;
  drafts: Draft[];
  heartbeats: Heartbeat[];
  /** Names of tabs that failed validation. */
  badTabs: { tab: string; error: string }[];
  feedErrors: string[];
  generatedAt: string;
}

export interface ModelInput {
  result: { ok: true; feed: FeedDataT; fetchedAt: number } | { ok: false; lastGoodAt: number | null };
  now: DateTime;
  demo: boolean;
  appTimezone?: string;
}

function greetingFor(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function buildModel(input: ModelInput): Model {
  const tz = input.appTimezone ?? 'America/Toronto';
  const feed: FeedDataT | null = input.result.ok ? input.result.feed : null;
  const tabs = feed?.tabs ?? {};
  const badTabs: { tab: string; error: string }[] = [];
  const read = <N extends Parameters<typeof parseTab>[1]>(name: N) => {
    const p = parseTab(tabs, name);
    if (p.bad && feed) badTabs.push({ tab: name, error: p.error ?? 'invalid' });
    return p;
  };

  const configTab = read('Config');
  const config = parseConfig(configTab.bad ? [] : configTab.rows, tz);
  const now = input.now.setZone(config.timezone);

  const switchTab = read('Switches');
  const switches: Record<string, boolean> = {};
  for (const n of SWITCH_NAMES) switches[n] = false; // R3: missing or malformed means OFF
  if (!switchTab.bad) for (const r of switchTab.rows) if (r.on === 'TRUE') switches[r.switch] = true;

  const viewTab = read('Views');
  const views: Record<string, ViewStatus> = {};
  for (const n of VIEW_NAMES) views[n] = n === 'tv' || n === 'home' ? 'live' : 'preview';
  if (!viewTab.bad) for (const r of viewTab.rows) views[r.view] = r.status;

  const hb = read('Heartbeat');
  const briefing = read('Briefing');
  const doneTab = read('Done');
  const needsTab = read('NeedsMe');
  const projTab = read('Projects');
  const deadTab = read('Deadlines');
  const draftTab = read('Drafts');

  const heartbeats = hb.bad ? [] : hb.rows;
  const morning: Freshness = hb.bad
    ? { state: 'stale', lastOkAt: null, message: 'BAD DATA: Heartbeat tab unreadable' }
    : morningFreshness(now, heartbeats, config);
  const okRun = hb.bad ? null : latestOkRunId(heartbeats, config.timezone);

  const trackerParsed = feed ? parseTracker(feed.tracker, config.timezone) : ({ ok: false, reason: 'Turnover copy unavailable' } as const);
  const snapshot = feed?.snapshot ?? null;
  const turnovers = summarizeTurnovers(trackerParsed, config, now, snapshot);
  const turnoverFresh = turnoverFreshness(now, trackerParsed.ok, turnovers.stamp, config);


  // Rows shown only for the latest ok run.
  const forRun = <T extends { run_id: string }>(rows: T[]) => (okRun ? rows.filter((r) => r.run_id === okRun) : []);

  const brief = briefing.bad ? [] : forRun(briefing.rows);
  const briefingHeadline = brief.length ? brief[brief.length - 1].headline : '';
  const doneRows = doneTab.bad ? [] : forRun(doneTab.rows).map((r) => r.text);
  const lines = [...doneRows, ...turnovers.movedSince].slice(0, 6);
  const done = lines.length ? lines : turnovers.ok ? ['No turnover steps moved since yesterday'] : [];
  const doneBad = briefing.bad || doneTab.bad;
  const doneNotice = doneBad ? 'BAD DATA: Done overnight could not be read' : morning.state === 'stale' ? morning.message : '';

  const deadlines = deadTab.bad ? [] : forRun(deadTab.rows);
  const needsRows = needsTab.bad
    ? []
    : needsTab.rows.filter((r) => !r.handled_at && (r.source === 'manual' || (okRun !== null && r.run_id === okRun)));
  const drafts = draftTab.bad ? [] : draftTab.rows;
  const needs = buildNeeds({
    turnovers, deadlines, needsMe: needsRows, config, now,
    draftsOn: switches.drafts === true,
    proposedDrafts: drafts.filter((d) => d.status === 'proposed').length,
  });
  const needsNotice = needsTab.bad || deadTab.bad ? 'BAD DATA: some of Needs you could not be read' : morning.state === 'stale' ? morning.message : '';

  const today = buildToday(feed?.calendar ?? [], turnovers, deadlines, now, config.timezone);
  const todayNotice = feed?.errors.includes('calendar_failed') ? 'BAD DATA: calendar could not be read' : '';

  let chips: ProjectChip[] | null = null;
  let chipsMessage = '';
  let chipsAsOf = '';
  if (projTab.bad) chipsMessage = 'BAD DATA: project status could not be read';
  else {
    const rows = forRun(projTab.rows);
    if (!rows.length) chipsMessage = 'Project status appears after the first morning run';
    else {
      chips = buildChips(rows, now, config.timezone);
      chipsAsOf = rows.map((r) => r.as_of).filter(Boolean).sort().pop() ?? '';
      if (morning.state === 'stale') chipsMessage = morning.message;
    }
  }

  const down = input.result.ok
    ? null
    : bridgeDownMessage(input.now, input.result.lastGoodAt ? DateTime.fromMillis(input.result.lastGoodAt) : null, tz);

  return {
    config, demo: input.demo, nowIso: now.toISO() ?? '',
    greeting: `${greetingFor(now.hour)}, ${config.ownerName}`,
    dateText: now.toFormat('cccc, LLLL d'), timeText: now.toFormat('h:mm a'),
    bridgeDown: down, morning, turnoverFresh, briefingHeadline, done, doneNotice,
    needs, needsNotice, today, todayNotice, turnovers, chips, chipsMessage, chipsAsOf,
    switches, views, drafts, heartbeats, badTabs, feedErrors: feed?.errors ?? [], generatedAt: feed?.generatedAt ?? '',
  };
}
