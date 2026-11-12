// R6: nothing sensitive reaches the TV view.
import { describe, expect, it } from 'vitest';
import { maskText, toTvView } from '@/lib/domain/tvView';
import { freshBridge, modelFrom } from './helpers/model';

describe('maskText', () => {
  it('masks emails, phone numbers, amounts and links', () => {
    expect(maskText('Write to sam@example.com')).toBe('Write to [hidden]');
    expect(maskText('Call 416-555-0199 now')).toBe('Call [hidden] now');
    expect(maskText('Call (416) 555 0199')).toBe('Call [hidden]');
    expect(maskText('Quote is $12,500.00 total')).toBe('Quote is [hidden] total');
    expect(maskText('Offer 450000 dollars')).toBe('Offer [hidden]');
    expect(maskText('See https://example.com/x?y=1 ok')).toBe('See [hidden] ok');
  });
  it('leaves dates alone', () => {
    expect(maskText('Due 2026-11-12')).toBe('Due 2026-11-12');
  });
});

describe('toTvView', () => {
  it('has no links, details, drafts, scope text or notes', async () => {
    const b = freshBridge();
    b.state.tabs.NeedsMe[1].title = 'Quote $9,000 from sam@example.com 416-555-0199';
    const view = toTvView(await modelFrom(b));
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/https?:/);
    expect(json).not.toMatch(/@example/);
    expect(json).not.toMatch(/\$9,000|555-0199/);
    expect(json).not.toContain('Replace vanity');
    expect(json).not.toContain('Waiting on paint order');
    expect(json).not.toContain('Tuesday at 10 works');
    expect(view.needs.length).toBeLessThanOrEqual(6);
  });
  it('shows Busy for event titles when tv_show_event_titles is FALSE', async () => {
    const b = freshBridge();
    b.state.tabs.Config.find((r) => r.key === 'tv_show_event_titles')!.value = 'FALSE';
    const view = toTvView(await modelFrom(b));
    expect(view.today.filter((t) => t.time).every((t) => t.title === 'Busy')).toBe(true);
    expect(JSON.stringify(view)).not.toContain('Site walk');
  });
  it('shows "+N more" when there are more than six cards', async () => {
    const b = freshBridge();
    const view = toTvView(await modelFrom(b));
    expect(view.needsCount).toBeGreaterThan(6);
    expect(view.needsMore).toBe(view.needsCount - 6);
  });
});
