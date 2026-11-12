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
