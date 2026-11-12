// Repo-wide rules: guards on owner routes, a single sender, no secrets or real identifiers outside allowed files.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
const files = walk(root);

describe('every owner page, action and route calls a guard', () => {
  const publicPaths = [/^src\/app\/tv\//, /^src\/app\/signin\//, /^src\/app\/api\/auth\//, /^src\/app\/api\/health\//, /^src\/app\/robots\.ts$/, /^src\/app\/layout\.tsx$/];
  const owners = files.map(rel).filter((f) => /^src\/app\/.*(page\.tsx|route\.ts|actions\.ts)$/.test(f) && !publicPaths.some((re) => re.test(f)));
  it('finds the owner routes', () => {
    expect(owners).toEqual(expect.arrayContaining(['src/app/page.tsx', 'src/app/settings/page.tsx', 'src/app/team/page.tsx', 'src/app/approvals/page.tsx', 'src/app/actions.ts']));
  });
  it.each(owners)('%s calls requireOwner or requireCapability', (f) => {
    expect(fs.readFileSync(path.join(root, f), 'utf8')).toMatch(/require(Owner|Capability)\(/);
  });
  it('every exported server action calls a guard before anything else', () => {
    const src = fs.readFileSync(path.join(root, 'src/app/actions.ts'), 'utf8');
    const bodies = src.split(/export async function /).slice(1);
    expect(bodies.length).toBeGreaterThanOrEqual(5);
    for (const b of bodies) {
      expect(b).toMatch(/await assertSameOrigin\(\);/);
      expect(b).toMatch(/require(Owner|Capability)\(/);
    }
  });
});

describe('sending email', () => {
  it('only bridge/src/gmailSend.js calls a send API', () => {
    const sendApi = /Drafts\.send|GmailApp|MailApp|\.sendEmail\(|messages\/send|users\.messages\.send|mcp__Gmail__send/;
    const offenders = files
      .map(rel)
      .filter((f) => /\.(ts|tsx|js|mjs|gs)$/.test(f) && !f.startsWith('tests/') && !f.startsWith('bridge/dist'))
      .filter((f) => sendApi.test(fs.readFileSync(path.join(root, f), 'utf8')));
    expect(offenders).toEqual(['bridge/src/gmailSend.js']);
  });
});

describe('no secrets or real identifiers', () => {
  const allowedReal = [/^bridge\/src\/seed\.js$/, /^bridge\/dist/, /^automations\//, /^claude\//, /^PLAN\.md$/, /^HANDOFF\.md$/, /^tests\/repo-rules\.test\.ts$/, /^bridge\/build\.mjs$/];
  const scanned = files.map(rel).filter((f) => /\.(ts|tsx|js|mjs|md|json|css|gs|example)$/.test(f) && !f.includes('package-lock') && !allowedReal.some((re) => re.test(f)));
  const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
  it('has no real sheet or doc identifiers outside allowed files', () => {
    for (const f of scanned) {
      const t = read(f);
      expect(t, f).not.toMatch(/1czLrS6VfIPNP8lVxnF4|7AiyoZSJ1qn2tpjZpd8HWc|1QPNj4L9m9Es_FxFSTJ0Ml/);
    }
  });
  it('has no real company names or personal email addresses', () => {
    for (const f of scanned) {
      const t = read(f);
      expect(t, f).not.toMatch(/baltocapital|balto capital/i);
      if (f === 'tests/auth.test.ts') continue; // uses look-alike domains on purpose
      const emails = t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
      for (const e of emails) expect(e, f).toMatch(/@(example\.(com|org|net)|users\.noreply\.github\.com)$/i);
    }
  });
  it('has no key-like secrets', () => {
    for (const f of scanned) {
      expect(read(f), f).not.toMatch(/(AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|GOCSPX-[0-9A-Za-z_-]+|sk-[A-Za-z0-9]{30,})/);
    }
  });
  it('commits no env files except the example', () => {
    expect(files.map(rel).filter((f) => /(^|\/)\.env/.test(f))).toEqual(['.env.example']);
  });
});
