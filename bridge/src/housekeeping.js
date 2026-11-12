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
