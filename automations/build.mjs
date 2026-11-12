// Builds automations/morning-run.md from the template, filling {{TABS}} from src/lib/feed/schema.ts.
// Usage: node automations/build.mjs   (Node 22.6+ strips the TypeScript types itself)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

export async function buildPrompt() {
  const schema = await import(pathToFileURL(path.join(root, 'src/lib/feed/schema.ts')).href);
  const template = fs.readFileSync(path.join(here, 'morning-run.template.md'), 'utf8');
  const lines = schema.MORNING_RUN_TABS.map((name) => `Tab ${name}: ${schema.columnsOf(name).join(' | ')}`).join('\n');
  return template.replace('{{TABS}}', lines);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(here, 'morning-run.md'), await buildPrompt());
  console.log('automations/morning-run.md written');
}
