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
