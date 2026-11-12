/**
 * Balto Ops Command Center: Bridge.
 * A thin, locked pipe between the Feed sheet and the Screen app.
 * Paste this whole file into the Apps Script project bound to the Feed sheet.
 * @OnlyCurrentDoc
 */

// Pure helpers: they touch no Google service except the Utilities object (shimmed in tests).

var MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function parseAppStamp(cellText) {
  var m = /\(([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?\)/i.exec(String(cellText || ''));
  if (!m) return null;
  var month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  var hour = Number(m[4]) % 12;
  if (m[6].toLowerCase() === 'p') hour += 12;
  return { year: Number(m[3]), month: month + 1, day: Number(m[2]), hour: hour, minute: Number(m[5]) };
}

function bytesToHex(bytes) { // Apps Script returns signed bytes (-128..127)
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function verifyRequest(body, secret, nowMs, seenNonce) {
  if (!body || body.v !== 1) return { ok: false, error: 'bad_version' };
  var ts = Number(body.ts);
  if (!isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return { ok: false, error: 'stale_request' };
  var base = [body.ts, body.nonce, body.action, body.payload].join('\n');
  var expected = bytesToHex(Utilities.computeHmacSha256Signature(base, secret));
  if (!safeEqual(expected, String(body.sig))) return { ok: false, error: 'bad_signature' };
  if (seenNonce && seenNonce(body.nonce)) return { ok: false, error: 'replay' };
  return { ok: true, action: body.action, payload: JSON.parse(body.payload) };
}

/** SHA-256 hex of a string. */
function sha256Hex(text) {
  return bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

/** Turn sheet rows (arrays) into objects keyed by the header row. Skips fully empty rows. */
function rowsToObjects(header, rows) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var obj = {}, any = false;
    for (var c = 0; c < header.length; c++) {
      var v = rows[i][c] === undefined || rows[i][c] === null ? '' : String(rows[i][c]);
      obj[header[c]] = v;
      if (v !== '') any = true;
    }
    if (any) out.push(obj);
  }
  return out;
}

/** Pad a ragged row to a given width with empty strings. */
function padRow(row, width) {
  var out = (row || []).slice(0, width);
  while (out.length < width) out.push('');
  return out;
}

/** Find the turnover rows in a mirror grid. Headings are in row 3; data starts at row 4. Returns null if unusable. */
function parseTrackerGrid(grid) {
  if (!grid || grid.length < 3) return null;
  if (/^#(REF|N\/A|ERROR|VALUE|NAME|NUM|DIV)/i.test(String(grid[0][0] || ''))) return null;
  var head = (grid[2] || []).map(function (h) { return String(h || '').trim(); });
  var pi = head.indexOf('Property'), ui = head.indexOf('Unit'), si = head.indexOf('Current stage');
  if (pi < 0 || ui < 0 || si < 0) return null;
  var out = [];
  for (var r = 3; r < grid.length; r++) {
    var row = padRow(grid[r], head.length);
    if (!row[pi] && !row[ui]) continue;
    out.push({ property: row[pi], unit: row[ui], stage: row[si] });
  }
  return out;
}

/** The YYYY-MM-DD a row belongs to, for clean-up. Empty string when it cannot be told. */
function rowDate(tab, row) {
  var src = '';
  if (tab === 'Heartbeat') src = row.started_at || row.run_id;
  else if (tab === 'Briefing') src = row.generated_at || row.run_id;
  else if (tab === 'Done') src = row.at || row.run_id;
  else if (tab === 'NeedsMe') src = row.run_id || row.created_at || row.handled_at;
  else src = row.run_id;
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(src || ''));
  return m ? m[1] : '';
}

/** Should housekeeping delete this row? cutoff is a YYYY-MM-DD string; older rows go. */
function shouldDeleteRow(tab, row, cutoff) {
  if (tab === 'NeedsMe' && row.source === 'manual' && !row.handled_at) return false;
  var d = rowDate(tab, row);
  return d !== '' && d < cutoff;
}

// The Feed tab definitions. Kept equal to src/lib/feed/schema.ts by a test.
var TABS = [
  { name: 'Switches', columns: ['switch', 'on', 'what_it_does', 'changed_at', 'changed_by'] },
  { name: 'Views', columns: ['view', 'status', 'changed_at', 'changed_by'] },
  { name: 'Config', columns: ['key', 'value', 'note'] },
  { name: 'Heartbeat', columns: ['job', 'run_id', 'started_at', 'finished_at', 'status', 'summary', 'counts'], appendOnly: true },
  { name: 'Briefing', columns: ['run_id', 'generated_at', 'headline', 'covers_from', 'covers_to'], appendOnly: true },
  { name: 'Done', columns: ['run_id', 'at', 'text', 'detail', 'kind'], appendOnly: true },
  { name: 'NeedsMe', columns: ['id', 'run_id', 'source', 'category', 'title', 'detail', 'link', 'due', 'project', 'created_at', 'handled_at', 'handled_by'], appendOnly: true },
  { name: 'Projects', columns: ['run_id', 'project', 'where_it_stands', 'next_date', 'next_label', 'open_items', 'blocked', 'doc_link', 'as_of'], appendOnly: true },
  { name: 'Deadlines', columns: ['run_id', 'project', 'label', 'date', 'kind', 'source'], appendOnly: true },
  { name: 'Drafts', columns: ['draft_id', 'run_id', 'thread_url', 'draft_url', 'to', 'subject', 'why', 'preview', 'created_at', 'status', 'decided_at', 'content_hash', 'error'], appendOnly: true },
  { name: 'State', columns: ['key', 'value', 'updated_at'] },
  { name: 'TurnoverSnapshots', columns: ['date', 'property', 'unit', 'stage'], appendOnly: true },
  { name: 'Audit', columns: ['at', 'actor', 'action', 'target', 'detail'] },
  { name: 'TrackerMirror', columns: [] },
  { name: 'Yardi', columns: ['note'] }
];

// Seed rows written by setup() when absent. These are the real starting values for the owner's system.
var SEED = {
  Switches: [
    ['team_views', 'FALSE', 'Show the Team page with each employee\'s jobs.', '', ''],
    ['email_triage', 'FALSE', 'Let the morning run sort email and add items to Needs you.', '', ''],
    ['drafts', 'FALSE', 'Let the morning run write draft replies for you to approve.', '', ''],
    ['send_on_approve', 'FALSE', 'Let the Approve button send the draft itself (needs the send build).', '', ''],
    ['yardi', 'FALSE', 'Reserved for Yardi Voyager data. Not connected.', '', '']
  ],
  Views: [
    ['tv', 'live', '', ''],
    ['home', 'live', '', ''],
    ['team', 'preview', '', ''],
    ['approvals', 'preview', '', '']
  ],
  Config: [
    ['owner_name', 'Ali', 'Name shown in the greeting.'],
    ['timezone', 'America/Toronto', ''],
    ['my_stages', '2. Scope of work; 6. Leasing upload', 'Stages that are waiting on you, separated by semicolons.'],
    ['turnover_sheet_url', 'https://docs.google.com/spreadsheets/d/1czLrS6VfIPNP8lVxnF4NOZbU274tp5jFbsAysjSwvj0', 'Source of the turnover copy.'],
    ['turnover_tab', 'From the app', 'Tab name in the turnover sheet.'],
    ['turnover_stale_hours', '72', 'Hours before the turnover copy counts as stale.'],
    ['morning_due_time', '09:30', 'Morning run counts as late after this time.'],
    ['morning_days', '1,2,3,4,5', 'Run days, 1 = Monday.'],
    ['dd_window_days', '14', 'Due-diligence dates inside this many days show in Needs you.'],
    ['work_projects', 'Edmonton B Renos & Ops; Yellowknife; Regina; Decon; Acquisitions & Deals', 'Projects shown on the board, separated by semicolons.'],
    ['tv_show_event_titles', 'TRUE', 'FALSE shows "Busy" for meetings on the TV.'],
    ['max_sends_per_hour', '10', 'Send limit when send_on_approve is on.']
  ],
  Yardi: [['Not connected. Reserved for Yardi Voyager data.']]
};

// Thin wrappers around the active spreadsheet. Uses SpreadsheetApp.getActiveSpreadsheet() only.

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tabDef(name) { for (var i = 0; i < TABS.length; i++) if (TABS[i].name === name) return TABS[i]; throw new Error('unknown_tab'); }
function nowIso() { return Utilities.formatDate(new Date(), 'America/Toronto', "yyyy-MM-dd'T'HH:mm:ssXXX"); }

/** Read a tab as objects keyed by its header. For append-only tabs, `last` limits to the newest rows. */
function readTab(name, last) {
  var sh = ss().getSheetByName(name);
  if (!sh) throw new Error('tab_missing');
  var width = tabDef(name).columns.length;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var start = 2;
  if (last && lastRow - 1 > last) start = lastRow - last + 1;
  var values = sh.getRange(start, 1, lastRow - start + 1, width).getDisplayValues();
  return rowsToObjects(tabDef(name).columns, values);
}

/** Row numbers (1-based) and objects for a tab, used by updates. */
function readTabWithRows(name) {
  var sh = ss().getSheetByName(name);
  var width = tabDef(name).columns.length;
  var lastRow = sh.getLastRow();
  var out = [];
  if (lastRow < 2) return { sheet: sh, rows: out };
  var values = sh.getRange(2, 1, lastRow - 1, width).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    var o = rowsToObjects(tabDef(name).columns, [values[i]]);
    if (o.length) out.push({ row: i + 2, obj: o[0] });
  }
  return { sheet: sh, rows: out };
}

function setCells(sh, row, cols, obj) { // cols = column names to write from obj
  var def = tabDef(sh.getName()).columns;
  for (var i = 0; i < cols.length; i++) sh.getRange(row, def.indexOf(cols[i]) + 1).setValue(String(obj[cols[i]]));
}

function appendObj(name, obj) {
  var cols = tabDef(name).columns;
  var row = cols.map(function (c) { return obj[c] === undefined ? '' : String(obj[c]); });
  var sh = ss().getSheetByName(name);
  var r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, cols.length).setValues([row]);
}

function audit(actor, action, target, detail) {
  appendObj('Audit', { at: nowIso(), actor: actor || 'owner', action: action, target: target, detail: detail || '' });
}

function getConfig(key) {
  var rows = readTab('Config');
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value;
  return '';
}

function getSwitchOn(name) {
  var rows = readTab('Switches');
  for (var i = 0; i < rows.length; i++) if (rows[i].switch === name) return rows[i].on === 'TRUE';
  return false;
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// Bridge actions. Each returns data or throws Error('code').

function clearFeedCache() { CacheService.getScriptCache().remove('feed'); }

function readCalendar() {
  var out = [];
  var events = CalendarApp.getDefaultCalendar().getEventsForDay(new Date());
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (ev.getMyStatus() === CalendarApp.GuestStatus.NO) continue;
    out.push({
      title: ev.getTitle(),
      start: Utilities.formatDate(ev.getStartTime(), 'America/Toronto', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      end: Utilities.formatDate(ev.getEndTime(), 'America/Toronto', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      allDay: ev.isAllDayEvent()
    });
  }
  return out;
}

function readSnapshot() {
  var today = Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM-dd');
  var rows = readTab('TurnoverSnapshots');
  var best = '';
  for (var i = 0; i < rows.length; i++) if (rows[i].date < today && rows[i].date > best) best = rows[i].date;
  if (!best) return null;
  return {
    date: best,
    rows: rows.filter(function (r) { return r.date === best; }).map(function (r) { return { property: r.property, unit: r.unit, stage: r.stage }; })
  };
}

function actionFeed() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('feed');
  if (hit) return JSON.parse(hit);
  var errors = [], tabs = {};
  TABS.forEach(function (t) {
    if (t.name === 'Audit' || t.name === 'TrackerMirror' || t.name === 'TurnoverSnapshots') return;
    try { tabs[t.name] = readTab(t.name, t.appendOnly ? 200 : 0); } catch (e) { errors.push('tab_failed:' + t.name); }
  });
  var tracker = [];
  try { tracker = ss().getSheetByName('TrackerMirror').getRange('A1:W600').getDisplayValues(); } catch (e) { errors.push('tracker_failed'); }
  var calendar = [];
  try { calendar = readCalendar(); } catch (e) { errors.push('calendar_failed'); }
  var snapshot = null;
  try { snapshot = readSnapshot(); } catch (e) { errors.push('snapshot_failed'); }
  var data = { generatedAt: nowIso(), tabs: tabs, tracker: tracker, calendar: calendar, snapshot: snapshot, errors: errors };
  var json = JSON.stringify(data);
  if (json.length < 90000) cache.put('feed', json, 60);
  return data;
}

function actionSetSwitch(p) {
  return withLock(function () {
    var t = readTabWithRows('Switches');
    var found = null;
    t.rows.forEach(function (r) { if (r.obj.switch === p.name) found = r; });
    if (!found) throw new Error('unknown_switch');
    var on = p.on === true ? 'TRUE' : 'FALSE';
    setCells(t.sheet, found.row, ['on', 'changed_at', 'changed_by'], { on: on, changed_at: nowIso(), changed_by: p.by || 'owner' });
    audit(p.by, 'setSwitch', p.name, on);
    clearFeedCache();
    return { switches: readTab('Switches') };
  });
}

function actionSetView(p) {
  return withLock(function () {
    if (p.status !== 'live' && p.status !== 'preview') throw new Error('bad_status');
    var t = readTabWithRows('Views');
    var found = null;
    t.rows.forEach(function (r) { if (r.obj.view === p.view) found = r; });
    if (!found) throw new Error('unknown_view');
    setCells(t.sheet, found.row, ['status', 'changed_at', 'changed_by'], { status: p.status, changed_at: nowIso(), changed_by: p.by || 'owner' });
    audit(p.by, 'setView', p.view, p.status);
    clearFeedCache();
    return { views: readTab('Views') };
  });
}

function actionDismiss(p) {
  return withLock(function () {
    var t = readTabWithRows('NeedsMe');
    var n = 0;
    t.rows.forEach(function (r) {
      if (r.obj.id === p.id) { setCells(t.sheet, r.row, ['handled_at', 'handled_by'], { handled_at: nowIso(), handled_by: p.by || 'owner' }); n++; }
    });
    if (!n) throw new Error('not_found');
    audit(p.by, 'dismiss', p.id, String(n));
    clearFeedCache();
    return { id: p.id };
  });
}

/** Approve with send_on_approve OFF: mark the draft opened and hand back its Gmail link. Sends nothing. */
function decideWithoutSending(p) {
  return withLock(function () {
    var t = readTabWithRows('Drafts');
    var found = null;
    t.rows.forEach(function (r) { if (r.obj.draft_id === p.draftId && r.obj.status === 'proposed') found = r; });
    if (!found) throw new Error('not_proposed');
    var status = p.decision === 'reject' ? 'rejected' : 'opened';
    setCells(t.sheet, found.row, ['status', 'decided_at'], { status: status, decided_at: nowIso() });
    audit(p.by, 'draft_' + status, p.draftId, '');
    clearFeedCache();
    return status === 'opened' ? { status: status, draftUrl: found.obj.draft_url } : { status: status };
  });
}

function actionDecide(p) {
  if (p.decision !== 'approve' && p.decision !== 'reject') throw new Error('bad_decision');
  if (p.decision === 'reject' || !getSwitchOn('send_on_approve')) return decideWithoutSending(p);
  if (typeof decideDraftLive !== 'function') throw new Error('send_not_installed');
  return decideDraftLive(p);
}

function actionDrafts() {
  if (typeof listDraftsLive !== 'function') throw new Error('send_not_installed');
  return listDraftsLive();
}

function handleAction(action, p) {
  switch (action) {
    case 'ping': return { time: nowIso() };
    case 'feed': return actionFeed();
    case 'setSwitch': return actionSetSwitch(p);
    case 'setView': return actionSetView(p);
    case 'dismiss': return actionDismiss(p);
    case 'drafts': return actionDrafts();
    case 'decide': return actionDecide(p);
    default: throw new Error('unknown_action');
  }
}

// setup(), showSecrets() and dailyHousekeeping(): run by hand once, or by the daily trigger.

function randomToken() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function setup() {
  var book = ss();
  book.setSpreadsheetTimeZone('America/Toronto');
  TABS.forEach(function (t) {
    var sh = book.getSheetByName(t.name);
    if (!sh) {
      sh = book.insertSheet(t.name);
      if (t.columns.length) {
        sh.getRange(1, 1, 1, t.columns.length).setValues([t.columns]).setFontWeight('bold');
        sh.setFrozenRows(1);
        if (t.name !== 'TrackerMirror') sh.getRange(1, 1, sh.getMaxRows(), t.columns.length).setNumberFormat('@');
      }
    }
    var seed = SEED[t.name];
    if (seed && sh.getLastRow() < 2) {
      sh.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
    }
  });
  var defaultSheet = book.getSheetByName('Sheet1');
  if (defaultSheet && book.getSheets().length > 1 && defaultSheet.getLastRow() === 0) book.deleteSheet(defaultSheet);

  var url = getConfig('turnover_sheet_url'), tab = getConfig('turnover_tab');
  var mirror = book.getSheetByName('TrackerMirror');
  mirror.getRange('A1').setFormula('=IMPORTRANGE("' + url + '", "\'' + tab + '\'!A1:W600")');
  ['C', 'D', 'J', 'L', 'O', 'R', 'T', 'V'].forEach(function (c) { mirror.getRange(c + ':' + c).setNumberFormat('yyyy-mm-dd'); });

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('BRIDGE_SECRET')) props.setProperty('BRIDGE_SECRET', randomToken());

  var have = ScriptApp.getProjectTriggers().some(function (tr) { return tr.getHandlerFunction() === 'dailyHousekeeping'; });
  if (!have) ScriptApp.newTrigger('dailyHousekeeping').timeBased().atHour(5).everyDays(1).create();
  Logger.log('Setup done. Next: open TrackerMirror and click "Allow access", then run showSecrets.');
}

function showSecrets() {
  Logger.log('BRIDGE_SECRET = ' + PropertiesService.getScriptProperties().getProperty('BRIDGE_SECRET'));
  Logger.log('TV_KEY = ' + randomToken());
  Logger.log('AUTH_SECRET = ' + randomToken());
}

function dailyHousekeeping() {
  withLock(function () {
    var today = Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM-dd');
    var grid = ss().getSheetByName('TrackerMirror').getRange('A1:W600').getDisplayValues();
    var units = parseTrackerGrid(grid);
    var snaps = ss().getSheetByName('TurnoverSnapshots');
    if (units && units.length) {
      var existing = readTab('TurnoverSnapshots').some(function (r) { return r.date === today; });
      if (!existing) {
        var vals = units.map(function (u) { return [today, u.property, u.unit, u.stage]; });
        snaps.getRange(snaps.getLastRow() + 1, 1, vals.length, 4).setValues(vals);
      }
    }
    var cut14 = Utilities.formatDate(new Date(Date.now() - 14 * 86400000), 'America/Toronto', 'yyyy-MM-dd');
    var cut30 = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), 'America/Toronto', 'yyyy-MM-dd');
    deleteOldRows('TurnoverSnapshots', cut14, function (r) { return r.date && r.date < cut14; });
    ['Heartbeat', 'Briefing', 'Done', 'Projects', 'Deadlines', 'NeedsMe'].forEach(function (name) {
      deleteOldRows(name, cut30, function (r) { return shouldDeleteRow(name, r, cut30); });
    });
    clearFeedCache();
  });
}

function deleteOldRows(name, cutoff, test) {
  var t = readTabWithRows(name);
  for (var i = t.rows.length - 1; i >= 0; i--) if (test(t.rows[i].obj)) t.sheet.deleteRow(t.rows[i].row);
}

// Web app entry point: verify the signed request, then run the action.

var MUTATING = { setSwitch: true, setView: true, dismiss: true, decide: true };

function seenNonce(nonce) {
  var cache = CacheService.getScriptCache();
  var key = 'nonce:' + nonce;
  if (cache.get(key)) return true;
  cache.put(key, '1', 600);
  return false;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('BRIDGE_SECRET');
    if (!secret) return reply({ ok: false, error: 'not_set_up' });
    var v = verifyRequest(body, secret, Date.now(), MUTATING[body.action] ? seenNonce : null);
    if (!v.ok) out = { ok: false, error: v.error };
    else out = { ok: true, data: handleAction(v.action, v.payload) };
  } catch (err) {
    var msg = String(err && err.message || '');
    out = { ok: false, error: /^[a-z_]{3,40}$/.test(msg) ? msg : 'server_error' };
  }
  return reply(out);
}

function doGet() { return reply({ ok: false, error: 'post_only' }); }

// Gmail send support. The ONLY file that touches Gmail. Included only in the dist-send build.
// Uses the advanced Gmail service (Gmail.Users.Drafts.get / .send).

function b64urlDecodeToString(data) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
}

/**
 * Read To, Cc, Bcc, Subject, the text/plain body and the attachment count from a Gmail draft resource.
 * `decode` turns a base64url string into text.
 */
function extractDraftContent(draft, decode) {
  var payload = (draft && draft.message && draft.message.payload) || {};
  var headers = {};
  (payload.headers || []).forEach(function (h) { headers[String(h.name).toLowerCase()] = h.value; });
  var body = '', attachments = 0;
  function walk(part) {
    if (!part) return;
    var isAttachment = !!(part.filename && part.filename.length) || !!(part.body && part.body.attachmentId);
    if (isAttachment) { attachments++; return; }
    if (part.mimeType === 'text/plain' && part.body && part.body.data && !body) body = decode(part.body.data);
    (part.parts || []).forEach(walk);
  }
  walk(payload);
  return {
    to: headers.to || '', cc: headers.cc || '', bcc: headers.bcc || '', subject: headers.subject || '',
    body: body, attachments: attachments
  };
}

function contentHashText(c) { return [c.to, c.cc, c.bcc, c.subject, c.body].join('\n'); }

/**
 * The decision logic, with every outside effect passed in as `deps` so it can be tested.
 * deps: switchOn(name), findProposed(id), readDraft(id), maxPerHour(), sentInLastHour(), send(id),
 *       mark(id, fields), audit(action, target, detail), hash(text)
 * Refusals (changed, needs_gmail, rate_limited, ...) leave the draft proposed and send nothing.
 * An unexpected failure sets status=error and sends nothing.
 */
function decideDraftCore(deps, p) {
  if (!deps.switchOn('send_on_approve')) throw new Error('send_off');
  if (!deps.findProposed(p.draftId)) throw new Error('not_proposed');
  var c = deps.readDraft(p.draftId);
  var hash = deps.hash(contentHashText(c));
  if (hash !== p.hash) { deps.audit('draft_refused', p.draftId, 'changed'); throw new Error('changed'); }
  if (c.attachments > 0 || c.bcc) { deps.audit('draft_refused', p.draftId, 'needs_gmail'); throw new Error('needs_gmail'); }
  if (deps.sentInLastHour() >= deps.maxPerHour()) { deps.audit('draft_refused', p.draftId, 'rate_limited'); throw new Error('rate_limited'); }
  try {
    deps.send(p.draftId);
  } catch (e) {
    deps.mark(p.draftId, { status: 'error', error: 'send_failed' });
    deps.audit('draft_error', p.draftId, 'send_failed');
    throw new Error('send_failed');
  }
  deps.mark(p.draftId, { status: 'sent', content_hash: hash });
  deps.audit('draft_sent', p.draftId, '');
  return { status: 'sent' };
}

function readLiveDraft(draftId) {
  var d = Gmail.Users.Drafts.get('me', draftId, { format: 'full' });
  return extractDraftContent(d, b64urlDecodeToString);
}

function listDraftsLive() {
  var rows = readTab('Drafts').filter(function (r) { return r.status === 'proposed'; });
  var out = [];
  rows.forEach(function (r) {
    try {
      var c = readLiveDraft(r.draft_id);
      out.push({ draftId: r.draft_id, to: c.to, cc: c.cc, subject: c.subject, body: c.body, hash: sha256Hex(contentHashText(c)), attachments: c.attachments, hasBcc: !!c.bcc });
    } catch (e) {
      out.push({ draftId: r.draft_id, error: 'unreadable' });
    }
  });
  return { drafts: out };
}

function decideDraftLive(p) {
  return withLock(function () {
    var deps = {
      switchOn: getSwitchOn,
      findProposed: function (id) { return readTab('Drafts').some(function (r) { return r.draft_id === id && r.status === 'proposed'; }); },
      readDraft: readLiveDraft,
      maxPerHour: function () { return Number(getConfig('max_sends_per_hour')) || 10; },
      sentInLastHour: function () {
        var since = Date.now() - 3600000;
        return readTab('Audit', 200).filter(function (r) { return r.action === 'draft_sent' && new Date(r.at).getTime() > since; }).length;
      },
      send: function (id) { Gmail.Users.Drafts.send({ id: id }, 'me'); },
      mark: function (id, fields) {
        var t = readTabWithRows('Drafts');
        t.rows.forEach(function (r) {
          if (r.obj.draft_id === id) {
            fields.decided_at = nowIso();
            setCells(t.sheet, r.row, Object.keys(fields), fields);
          }
        });
      },
      audit: function (action, target, detail) { audit(p.by, action, target, detail); },
      hash: sha256Hex
    };
    var out = decideDraftCore(deps, p);
    clearFeedCache();
    return out;
  });
}
