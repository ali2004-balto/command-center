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

if (typeof module !== 'undefined') module.exports = { parseAppStamp: parseAppStamp, bytesToHex: bytesToHex, safeEqual: safeEqual, verifyRequest: verifyRequest, sha256Hex: sha256Hex, rowsToObjects: rowsToObjects, padRow: padRow, parseTrackerGrid: parseTrackerGrid, rowDate: rowDate, shouldDeleteRow: shouldDeleteRow };
