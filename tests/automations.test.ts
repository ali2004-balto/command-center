// The generated morning-run prompt must be current and list every written tab in schema order.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MORNING_RUN_TABS, columnsOf } from '@/lib/feed/schema';
import { loadBuild } from './helpers/loadBuild';

const root = path.resolve(__dirname, '..');

describe('automations/morning-run.md', () => {
  it('is up to date with the template and schema', async () => {
    const { buildPrompt } = await loadBuild();
    expect(fs.readFileSync(path.join(root, 'automations/morning-run.md'), 'utf8')).toBe(await buildPrompt());
  });
  it('lists every written tab with its columns in schema order', () => {
    const text = fs.readFileSync(path.join(root, 'automations/morning-run.md'), 'utf8');
    for (const tab of MORNING_RUN_TABS) expect(text).toContain(`Tab ${tab}: ${columnsOf(tab).join(' | ')}`);
    expect(text).not.toContain('{{TABS}}');
  });
  it('never lets the run touch protected tabs', () => {
    const text = fs.readFileSync(path.join(root, 'automations/morning-run.md'), 'utf8');
    expect(text).toContain('Never change the tabs Switches, Views, Config, Audit, TrackerMirror, TurnoverSnapshots or Yardi.');
  });
});

describe('claude/project-instructions.md', () => {
  it('exists and keeps the never-send rule', () => {
    const text = fs.readFileSync(path.join(root, 'claude/project-instructions.md'), 'utf8');
    expect(text).toContain('Send, forward, archive or delete email.');
  });
});
