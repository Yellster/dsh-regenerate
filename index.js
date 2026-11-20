import { randomUUID } from 'node:crypto';

/** Host half of dsh-regenerate.
 *
 * Two narrow POST routes live here:
 *   - /api/dsh-regenerate          re-stages original file attachments into a
 *     receiving Session (used by the inline editor's append-prompt flow).
 *   - /api/dsh-regenerate/regenerate analyses the target turn and injects a
 *     frozen host-runner continuation message through agent.followup(), so a
 *     regeneration asks the model to discard its previous final response
 *     without adding a user chat bubble or rewriting the append-only log.
 */
const ROUTE = '/api/dsh-regenerate';

function json(res, value, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(value));
}

function sameOrigin(req) {
  try {
    const host = String(req.headers.host || '');
    if (!host) return true;
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)) return false;
    const pick = String(req.headers.origin || req.headers.referer || '');
    if (!pick) return true;
    const url = new URL(pick);
    if (url.host.toLowerCase() === host.toLowerCase()) return true;
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    return (url.hostname + ':' + port).toLowerCase() === host.toLowerCase();
  } catch (_error) {
    return false;
  }
}

function requestPath(req) {
  const raw = String((req && (req.url || req.path)) || '');
  return raw.split('?')[0].replace(/\/+$/, '');
}

function errorMessage(error) {
  return (error && error.message) || String(error || 'request failed');
}

/** Recursively freeze a value so injected messages cannot be mutated. */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/** Build an immutable user-role message with a fresh id. */
export function createFrozenUserMessage(input) {
  return deepFreeze(structuredClone({ ...input, id: randomUUID(), role: 'user' }));
}

/** Find the requested (or last) turn and the user prompt that opened it. */
export function inspectTurnForRegenerate(events, requestedTurn) {
  if (!Array.isArray(events)) return null;
  let turnEnd = null;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event || event.type !== 'turn/end') continue;
    if (requestedTurn !== undefined && event.data && event.data.turn !== requestedTurn) continue;
    turnEnd = event;
    break;
  }
  if (!turnEnd) return null;
  const data = turnEnd.data || {};
  const turn = data.turn;
  let turnStartSeq = -1;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event && event.type === 'turn/start' && event.data && event.data.turn === turn) {
      turnStartSeq = typeof event.seq === 'number' ? event.seq : i;
      break;
    }
  }
  let firstUserMessage = null;
  let hasAssistantMessage = false;
  let hasToolCalls = false;
  for (const event of events) {
    if (!event) continue;
    const seq = typeof event.seq === 'number' ? event.seq : events.indexOf(event);
    if (seq < turnStartSeq || seq > turnEnd.seq) continue;
    const body = event.data || {};
    if (event.type === 'user/message' && body.surfaceOp === 'append'
      && body.source && body.source.kind === 'user' && !firstUserMessage) {
      firstUserMessage = { seq, content: body.content };
    } else if (event.type === 'assistant/message' && body.surfaceOp === 'append') {
      hasAssistantMessage = true;
    } else if (event.type === 'tool/call') {
      hasToolCalls = true;
    }
  }
  const reasonKind = data.reason && data.reason.kind;
  const error = reasonKind === 'error'
    ? ((data.reason && data.reason.error) || data.error)
    : undefined;
  return {
    turn,
    turnStartSeq,
    turnEndSeq: turnEnd.seq,
    reasonKind,
    error,
    hasAssistantMessage,
    hasToolCalls,
    firstUserMessage,
    branchBeforeTurnSeq: turnStartSeq,
  };
}

/** Compose the hidden instruction that tells the model to start over. */
export function createRegenerateContinuationMessage(turnInfo, customNote, content) {
  const turn = turnInfo.turn;
  const reason = turnInfo.reasonKind;
  let reasonText = 'The user requested regeneration of turn ' + turn + '.';
  if (reason === 'error') {
    reasonText += ' The previous turn ended with an error: ' + errorMessage(turnInfo.error) + '.';
  } else if (reason === 'interrupted' || reason === 'aborted') {
    reasonText += ' The previous turn was interrupted before it finished.';
  } else if (reason === 'max-tokens' || reason === 'blocked') {
    reasonText += ' The previous turn stopped before producing a complete answer.';
  }
  const progressNote = (turnInfo.hasAssistantMessage || turnInfo.hasToolCalls)
    ? 'Review completed steps and tool results, avoid repeating successful side effects, and regenerate from where execution stopped.'
    : 'No assistant response was committed. Generate a complete response directly.';
  const instruction = [
    '<system-reminder>',
    reasonText,
    'Disregard your previous final response in turn ' + turn + ' and generate a fresh, complete response.',
    progressNote,
    customNote ? 'Additional user instruction for regeneration: ' + customNote : null,
    '</system-reminder>',
  ].filter(Boolean).join('\n');
  return createFrozenUserMessage({
    content: [{ type: 'text', text: instruction }, ...(Array.isArray(content) ? content : [])],
    source: { kind: 'cordis-host-runner', form: 'regenerate', turn, reason },
  });
}

/** Resolve the live Agent for a Session, using the host services when present. */
export function resolveTargetAgent(ctx, sessionId) {
  const agents = ctx && typeof ctx.get === 'function' ? ctx.get('agents') : undefined;
  if (agents && typeof agents.get === 'function') {
    const agent = agents.get(sessionId);
    if (agent) return agent;
  }
  const controller = ctx && typeof ctx.get === 'function' ? ctx.get('sessionController') : undefined;
  if (controller && typeof controller.resolveAgent === 'function') {
    const resolved = controller.resolveAgent(sessionId);
    if (resolved && resolved.error) throw new Error(errorMessage(resolved.error));
    if (resolved && resolved.agent) return resolved.agent;
    if (resolved && typeof resolved.followup === 'function') return resolved;
  }
  throw new Error('session unavailable');
}

/** Read a Session's event log, disposing an observer when one is needed. */
export function readSessionEvents(ctx, sessionId) {
  let agent = null;
  try { agent = resolveTargetAgent(ctx, sessionId); } catch (_error) { /* try observer */ }
  if (agent && typeof agent.snapshotEvents === 'function') return agent.snapshotEvents();
  const query = ctx && typeof ctx.get === 'function' ? ctx.get('sessionQuery') : undefined;
  if (query && typeof query.observeSession === 'function') {
    const observed = query.observeSession(sessionId);
    if (observed && Array.isArray(observed.events)) {
      const events = observed.events.slice();
      if (typeof observed[Symbol.dispose] === 'function') observed[Symbol.dispose]();
      return events;
    }
  }
  throw new Error('session events unavailable');
}

async function streamToBase64(ctx, ref) {
  const attachments = ctx && typeof ctx.get === 'function' ? ctx.get('attachments') : undefined;
  if (!attachments || typeof attachments.readFileStream !== 'function') return null;
  const chunks = [];
  for await (const chunk of attachments.readFileStream(ref)) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('base64');
}

/** Rebuild the original prompt's attachments for the receiving Agent. */
async function rebuildContent(ctx, sessionId, turnInfo) {
  const original = turnInfo.firstUserMessage && turnInfo.firstUserMessage.content;
  if (typeof original === 'string') return [{ type: 'text', text: original }];
  if (!Array.isArray(original)) return [];
  const blocks = [];
  for (const block of original) {
    if (!block) continue;
    if (block.type === 'text' && typeof block.text === 'string') {
      blocks.push({ type: 'text', text: block.text });
    } else if (block.type === 'image' && block.attachment) {
      try {
        const data = await streamToBase64(ctx, block.attachment);
        if (data) {
          blocks.push({
            type: 'image',
            mediaType: block.attachment.mediaType,
            data,
            ...(block.attachment.name ? { name: block.attachment.name } : {}),
          });
        }
      } catch (_error) { /* skip an unreadable image */ }
    } else if (block.type === 'file' && block.attachment) {
      try {
        const attachments = ctx.get('attachments');
        const fileUploads = ctx.get('fileUploads');
        if (!attachments || !fileUploads) continue;
        const upload = await fileUploads.uploadStream({
          sessionId,
          data: attachments.readFileStream(block.attachment),
          name: block.attachment.name,
        });
        if (upload && upload.receiptId) blocks.push({ type: 'file', receiptId: upload.receiptId });
      } catch (_error) { /* skip an unreadable file */ }
    }
  }
  return blocks;
}

/** Analyse a turn and inject a hidden regeneration continuation. */
export async function triggerSessionRegenerate(ctx, sessionId, options = {}) {
  const agent = resolveTargetAgent(ctx, sessionId);
  if (agent.running) throw new Error('session busy');
  const events = readSessionEvents(ctx, sessionId);
  const turnInfo = inspectTurnForRegenerate(events, options.turn);
  if (!turnInfo) throw new Error('turn unavailable');
  const content = await rebuildContent(ctx, sessionId, turnInfo);
  const message = createRegenerateContinuationMessage(turnInfo, options.note, content);
  const result = await agent.followup(message);
  return {
    sessionId: agent.id || sessionId,
    regeneratedTurn: turnInfo.turn,
    reasonKind: turnInfo.reasonKind,
    messageId: (result && (result.messageId || result.id)) || message.id,
  };
}

function validTurn(value) {
  return value === undefined || (Number.isSafeInteger(value) && value > 0);
}

function validNote(value) {
  return value === undefined || (typeof value === 'string' && value.trim() !== '');
}

async function readPayload(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleRegenerate(ctx, req, res) {
  if (!sameOrigin(req)) return json(res, { ok: false, error: { code: 'forbidden', message: 'forbidden' } }, 403);
  let payload;
  try {
    payload = await readPayload(req);
  } catch (_error) {
    return json(res, { ok: false, error: { code: 'bad-request', message: 'bad request' } }, 400);
  }
  const sessionId = payload && payload.sessionId;
  const turn = payload ? payload.turn : undefined;
  const note = payload ? payload.note : undefined;
  if (typeof sessionId !== 'string' || !sessionId || !validTurn(turn) || !validNote(note)) {
    return json(res, { ok: false, error: { code: 'bad-request', message: 'bad request' } }, 400);
  }
  try {
    const value = await triggerSessionRegenerate(ctx, sessionId, { turn, note });
    return json(res, { ok: true, value });
  } catch (error) {
    return json(res, { ok: false, error: { code: 'regenerate-failed', message: errorMessage(error) } }, 500);
  }
}

async function handleAttachments(ctx, req, res) {
  if (!sameOrigin(req)) return json(res, { error: 'forbidden' }, 403);
  let payload;
  try {
    payload = await readPayload(req);
  } catch (_error) {
    return json(res, { error: 'bad request' }, 400);
  }
  const childSessionId = payload && payload.childSessionId;
  const files = payload && payload.files;
  if (typeof childSessionId !== 'string' || !Array.isArray(files) || files.length > 32) {
    return json(res, { error: 'bad request' }, 400);
  }
  const attachments = ctx.get('attachments');
  const fileUploads = ctx.get('fileUploads');
  if (!attachments || !fileUploads) return json(res, { error: 'attachments unavailable' }, 503);
  const receiptIds = [];
  for (const ref of files) {
    if (!ref || typeof ref.attachmentId !== 'string' || typeof ref.name !== 'string') {
      return json(res, { error: 'invalid file reference' }, 400);
    }
    try {
      const data = attachments.readFileStream(ref);
      const upload = await fileUploads.uploadStream({ sessionId: childSessionId, data, name: ref.name });
      receiptIds.push(upload.receiptId);
    } catch (error) {
      return json(res, { error: errorMessage(error) }, 502);
    }
  }
  return json(res, { receiptIds }, 200);
}

export const inject = ['webServer'];

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('allow', 'POST');
        res.end();
        return;
      }
      if (requestPath(req).endsWith('/regenerate')) return handleRegenerate(ctx, req, res);
      return handleAttachments(ctx, req, res);
    },
  }), 'dsh-regenerate: host routes');
}
