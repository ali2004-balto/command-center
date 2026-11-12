// Concatenates bridge/src/*.js into bridge/dist/Code.gs (no Gmail) and bridge/dist-send/Code.gs (with Gmail send).
// Usage: node bridge/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = ['00_header.js', 'pure.js', 'tabs.js', 'seed.js', 'sheet.js', 'actions.js', 'housekeeping.js', 'main.js'];

function read(file) {
  // Remove the Node-only module.exports line so the file is plain Apps Script.
  return fs
    .readFileSync(path.join(here, 'src', file), 'utf8')
    .replace(/^if \(typeof module !== 'undefined'\)[\s\S]*?;\s*$/m, '')
    .trimEnd();
}

function build(outDir, files, manifest) {
  const dir = path.join(here, outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Code.gs'), files.map(read).join('\n\n') + '\n');
  fs.copyFileSync(path.join(here, manifest), path.join(dir, 'appsscript.json'));
}

build('dist', base, 'appsscript.json');
build('dist-send', [...base, 'gmailSend.js'], 'appsscript.send.json');
console.log('bridge built');
