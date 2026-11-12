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

if (typeof module !== 'undefined') module.exports = { extractDraftContent: extractDraftContent, decideDraftCore: decideDraftCore, contentHashText: contentHashText };
