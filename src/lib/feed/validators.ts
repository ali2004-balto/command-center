// zod validators for everything that comes from the Bridge, plus per-tab validation.
import { z } from 'zod';

const str = z.string();
const dateStr = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'date must be YYYY-MM-DD or blank');
const tsStr = z.string().regex(/^(\d{4}-\d{2}-\d{2}T.*)?$/, 'timestamp must be ISO 8601 or blank');
const boolStr = z.enum(['TRUE', 'FALSE', '']);

export const SwitchRow = z.object({ switch: str, on: boolStr, what_it_does: str, changed_at: str, changed_by: str });
export const ViewRow = z.object({ view: str, status: z.enum(['live', 'preview']), changed_at: str, changed_by: str });
export const ConfigRow = z.object({ key: str, value: str, note: str });
export const HeartbeatRow = z.object({
  job: str, run_id: str, started_at: tsStr, finished_at: tsStr,
  status: z.enum(['running', 'ok', 'failed']), summary: str, counts: str,
});
export const BriefingRow = z.object({ run_id: str, generated_at: tsStr, headline: str, covers_from: tsStr, covers_to: tsStr });
export const DoneRow = z.object({ run_id: str, at: tsStr, text: str, detail: str, kind: str });
export const NeedsMeRow = z.object({
  id: str.min(1), run_id: str, source: str, category: str, title: str, detail: str, link: str,
  due: dateStr, project: str, created_at: str, handled_at: str, handled_by: str,
});
export const ProjectRow = z.object({
  run_id: str, project: str, where_it_stands: str, next_date: dateStr, next_label: str,
  open_items: str, blocked: boolStr, doc_link: str, as_of: dateStr,
});
export const DeadlineRow = z.object({ run_id: str, project: str, label: str, date: dateStr, kind: str, source: str });
export const DraftRow = z.object({
  draft_id: str, run_id: str, thread_url: str, draft_url: str, to: str, subject: str, why: str, preview: str,
  created_at: str,
  status: z.enum(['proposed', 'opened', 'sent', 'rejected', 'error']),
  decided_at: str, content_hash: str, error: str,
});
export const StateRow = z.object({ key: str, value: str, updated_at: str });

export const TAB_VALIDATORS = {
  Switches: SwitchRow, Views: ViewRow, Config: ConfigRow, Heartbeat: HeartbeatRow, Briefing: BriefingRow,
  Done: DoneRow, NeedsMe: NeedsMeRow, Projects: ProjectRow, Deadlines: DeadlineRow, Drafts: DraftRow, State: StateRow,
} as const;
export type ValidatedTabName = keyof typeof TAB_VALIDATORS;

export type Switches = z.infer<typeof SwitchRow>;
export type Heartbeat = z.infer<typeof HeartbeatRow>;
export type Briefing = z.infer<typeof BriefingRow>;
export type Done = z.infer<typeof DoneRow>;
export type NeedsMe = z.infer<typeof NeedsMeRow>;
export type Project = z.infer<typeof ProjectRow>;
export type Deadline = z.infer<typeof DeadlineRow>;
export type Draft = z.infer<typeof DraftRow>;

export const CalendarEvent = z.object({ title: str, start: str, end: str, allDay: z.boolean() });
export type CalendarEventT = z.infer<typeof CalendarEvent>;

/** The raw `feed` response from the Bridge. Tabs are arrays of rows keyed by column name. */
export const FeedData = z.object({
  generatedAt: z.string(),
  tabs: z.record(z.string(), z.array(z.record(z.string(), z.string()))),
  tracker: z.array(z.array(z.string())),
  calendar: z.array(CalendarEvent),
  snapshot: z.object({ date: z.string(), rows: z.array(z.object({ property: z.string(), unit: z.string(), stage: z.string() })) }).nullable(),
  errors: z.array(z.string()),
});
export type FeedDataT = z.infer<typeof FeedData>;

export const BridgeEnvelope = z.union([
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export interface ParsedTab<T> { rows: T[]; bad: boolean; error?: string }

/** Validate one tab. A bad tab marks only itself as BAD DATA. */
export function parseTab<N extends ValidatedTabName>(tabs: Record<string, Record<string, string>[]>, name: N): ParsedTab<z.infer<(typeof TAB_VALIDATORS)[N]>> {
  const raw = tabs[name];
  if (!raw) return { rows: [], bad: true, error: 'tab missing' };
  const rows: any[] = [];
  for (const r of raw) {
    const res = TAB_VALIDATORS[name].safeParse(r);
    if (!res.success) return { rows: [], bad: true, error: res.error.issues[0]?.message ?? 'invalid row' };
    rows.push(res.data);
  }
  return { rows, bad: false };
}
