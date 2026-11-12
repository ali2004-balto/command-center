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
