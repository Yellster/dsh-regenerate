import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apply, inject, deepFreeze, createFrozenUserMessage,
  inspectTurnForRegenerate, createRegenerateContinuationMessage,
  triggerSessionRegenerate,
} from '../index.js';

// Capture the route handler registered by the Host half.
function makeHandler(services = {}) {
  let handler;
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(services, key);
  const attachments = hasOwn('attachments')
    ? services.attachments
    : { readFileStream(ref) { return { streamFor: ref.attachmentId }; } };
  const uploads = [];
  const fileUploads = hasOwn('fileUploads')
    ? services.fileUploads
    : { async uploadStream(args) { uploads.push(args); return { receiptId: 'r-' + uploads.length }; } };
  const ctx = {
    get(name) {
      if (name === 'attachments') return attachments;
      if (name === 'fileUploads') return fileUploads;
      if (name === 'agents') return services.agents;
      if (name === 'sessionController') return services.sessionController;
      if (name === 'sessionQuery') return services.sessionQuery;
      return undefined;
    },
    effect(fn) { fn(); return () => {}; },
    webServer: {
      register(options) {
        assert.equal(options.path, '/api/dsh-regenerate');
        assert.equal(options.kind, 'prefix');
        handler = options.handler;
        return () => {};
      },
    },
  };
  apply(ctx);
  assert.equal(typeof handler, 'function');
  return { handler, uploads, ctx };
}

function request(body, {
  method = 'POST',
  url = '/api/dsh-regenerate',
  headers = { host: '127.0.0.1:7926' },
} = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() { yield Buffer.from(payload, 'utf8'); },
  };
}

async function invoke(handler, body, options) {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value; this.ended = true; },
  };
  await handler(request(body, options), res);
  return { res, data: res.body === undefined ? undefined : JSON.parse(res.body) };
}

const fileRef = { attachmentId: 'a-1', name: 'notes.txt' };

test('host module injects only webServer', () => {
  assert.deepEqual(inject, ['webServer']);
});

test('non-POST methods are rejected with 405 and Allow: POST', async () => {
  const { handler } = makeHandler();
  const { res } = await invoke(handler, {}, { method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'POST');
});

test('same-origin guard rejects non-loopback hosts and foreign origins', async () => {
  const { handler } = makeHandler();
  const cases = [
    { host: 'example.com' },
    { host: '192.168.1.5:7926' },
    { host: '127.0.0.1:7926', origin: 'http://evil.example' },
    { host: '127.0.0.1:7926', origin: 'http://127.0.0.1:9999' },
    { host: '127.0.0.1:7926', referer: 'http://localhost:7926/x' },
  ];
  for (const headers of cases) {
    const { res, data } = await invoke(handler, { childSessionId: 's', files: [fileRef] }, { headers });
    assert.equal(res.statusCode, 403, JSON.stringify(headers));
    assert.equal(data.error, 'forbidden');
  }
});

test('loopback host with matching origin or referer is accepted', async () => {
  const { handler } = makeHandler();
  for (const headers of [
    { host: 'localhost:7926', origin: 'http://localhost:7926' },
    { host: '127.0.0.1:7926', referer: 'http://127.0.0.1:7926/chat' },
    { host: '[::1]:7926', origin: 'http://[::1]:7926' },
    { host: '127.0.0.1:7926' },
  ]) {
    const { res } = await invoke(handler, { childSessionId: 's', files: [] }, { headers });
    assert.equal(res.statusCode, 200, JSON.stringify(headers));
  }
});

test('malformed JSON and invalid payload shapes return 400', async () => {
  const { handler } = makeHandler();
  const bodies = [
    'not json',
    {},
    { childSessionId: 5, files: [] },
    { childSessionId: 's', files: 'x' },
    { childSessionId: 's', files: new Array(33).fill(fileRef) },
    { childSessionId: 's', files: [{ attachmentId: 'a' }] },
    { childSessionId: 's', files: [{ name: 'n' }] },
    { childSessionId: 's', files: [null] },
  ];
  for (const body of bodies) {
    const { res, data } = await invoke(handler, body);
    assert.equal(res.statusCode, 400, JSON.stringify(body).slice(0, 60));
    assert.ok(data.error);
  }
});

test('missing attachment services return 503', async () => {
  for (const services of [{ attachments: null }, { fileUploads: null }]) {
    const { handler } = makeHandler(services);
    const { res, data } = await invoke(handler, { childSessionId: 's', files: [fileRef] });
    assert.equal(res.statusCode, 503);
    assert.equal(data.error, 'attachments unavailable');
  }
});

test('files are re-staged into the receiving session in order', async () => {
  const { handler, uploads } = makeHandler();
  const refs = [fileRef, { attachmentId: 'a-2', name: 'report.pdf' }];
  const { res, data } = await invoke(handler, { childSessionId: 'session-9', files: refs });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(data.receiptIds, ['r-1', 'r-2']);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(uploads.map((u) => u.sessionId), ['session-9', 'session-9']);
  assert.deepEqual(uploads.map((u) => u.name), ['notes.txt', 'report.pdf']);
  assert.deepEqual(uploads.map((u) => u.data.streamFor), ['a-1', 'a-2']);
});

test('an empty file list succeeds without touching the upload intake', async () => {
  const { handler, uploads } = makeHandler();
  const { res, data } = await invoke(handler, { childSessionId: 's', files: [] });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(data.receiptIds, []);
  assert.equal(uploads.length, 0);
});

test('a failing read or upload surfaces 502 with the cause', async () => {
  const broken = makeHandler({
    attachments: { readFileStream() { throw new Error('gone'); } },
  });
  const r1 = await invoke(broken.handler, { childSessionId: 's', files: [fileRef] });
  assert.equal(r1.res.statusCode, 502);
  assert.equal(r1.data.error, 'gone');

  const rejected = makeHandler({
    fileUploads: { async uploadStream() { throw new Error('intake closed'); } },
  });
  const r2 = await invoke(rejected.handler, { childSessionId: 's', files: [fileRef] });
  assert.equal(r2.res.statusCode, 502);
  assert.equal(r2.data.error, 'intake closed');
});

// ---- host-driven regeneration (merged from the lost worktree) ----

function agentWith(events, overrides = {}) {
  const messages = [];
  const agent = {
    id: 'agent-1',
    running: false,
    snapshotEvents() { return events; },
    async followup(message) { messages.push(message); return { messageId: 'm-9' }; },
    ...overrides,
  };
  return { agent, messages };
}

const sampleEvents = [
  { seq: 1, type: 'turn/start', data: { turn: 3 } },
  {
    seq: 2,
    type: 'user/message',
    data: {
      surfaceOp: 'append',
      source: { kind: 'user' },
      content: [{ type: 'text', text: 'Explain X' }],
    },
  },
  { seq: 3, type: 'assistant/message', data: { surfaceOp: 'append' } },
  { seq: 4, type: 'turn/end', data: { turn: 3, reason: { kind: 'completed' } } },
];

test('injected messages are frozen copies with a fresh id', () => {
  const input = { content: [{ type: 'text', text: 'x' }], source: { kind: 'host' } };
  const message = createFrozenUserMessage(input);
  assert.equal(message.role, 'user');
  assert.match(message.id, /^[0-9a-f-]{36}$/);
  assert.ok(Object.isFrozen(message));
  assert.ok(Object.isFrozen(message.content));
  assert.notEqual(message.content, input.content);
  assert.deepEqual(deepFreeze({ a: [1] }), { a: [1] });
});

test('inspectTurnForRegenerate locates the last turn and its opening prompt', () => {
  const info = inspectTurnForRegenerate(sampleEvents);
  assert.equal(info.turn, 3);
  assert.equal(info.turnStartSeq, 1);
  assert.equal(info.turnEndSeq, 4);
  assert.equal(info.reasonKind, 'completed');
  assert.equal(info.hasAssistantMessage, true);
  assert.equal(info.hasToolCalls, false);
  assert.equal(info.firstUserMessage.content[0].text, 'Explain X');
  assert.equal(inspectTurnForRegenerate(sampleEvents, 2), null);
  assert.equal(inspectTurnForRegenerate(null), null);
});

test('inspectTurnForRegenerate captures error reason and tool activity', () => {
  const events = sampleEvents.map((event) => event.type === 'turn/end'
    ? { ...event, data: { turn: 3, reason: { kind: 'error', error: { message: 'boom' } } } }
    : event);
  events.splice(3, 0, { seq: 3.5, type: 'tool/call', data: {} });
  const info = inspectTurnForRegenerate(events);
  assert.equal(info.reasonKind, 'error');
  assert.equal(info.error.message, 'boom');
  assert.equal(info.hasToolCalls, true);
});

test('continuation asks for a fresh answer and adapts to progress', () => {
  const info = inspectTurnForRegenerate(sampleEvents);
  const message = createRegenerateContinuationMessage(info, 'be concise');
  assert.equal(message.source.kind, 'cordis-host-runner');
  assert.equal(message.source.form, 'regenerate');
  assert.equal(message.source.turn, 3);
  assert.ok(Object.isFrozen(message));
  const text = message.content[0].text;
  assert.ok(text.includes('Disregard your previous final response in turn 3'));
  assert.ok(text.includes('generate a fresh, complete response'));
  assert.ok(text.includes('Additional user instruction for regeneration: be concise'));
  assert.ok(text.includes('Review completed steps and tool results'));
  assert.ok(createRegenerateContinuationMessage({
    ...info, hasAssistantMessage: false, hasToolCalls: false,
  }).content[0].text.includes('No assistant response was committed'));
});

test('triggerSessionRegenerate injects one frozen followup', async () => {
  const { agent, messages } = agentWith(sampleEvents);
  const ctx = { get: (name) => (name === 'agents' ? { get: () => agent } : undefined) };
  const result = await triggerSessionRegenerate(ctx, 'sess');
  assert.equal(messages.length, 1);
  assert.ok(messages[0].content[0].text.includes('Disregard'));
  assert.deepEqual(result, {
    sessionId: 'agent-1', regeneratedTurn: 3, reasonKind: 'completed', messageId: 'm-9',
  });
});

test('triggerSessionRegenerate refuses a busy session', async () => {
  const { agent } = agentWith(sampleEvents, { running: true });
  const ctx = { get: (name) => (name === 'agents' ? { get: () => agent } : undefined) };
  await assert.rejects(() => triggerSessionRegenerate(ctx, 'sess'), /session busy/);
});

test('regenerate route injects a continuation and reports the turn', async () => {
  const { agent, messages } = agentWith(sampleEvents);
  const { handler } = makeHandler({ agents: { get: () => agent } });
  const { res, data } = await invoke(handler, { sessionId: 'sess', note: 'be concise' }, {
    url: '/api/dsh-regenerate/regenerate',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(data.ok, true);
  assert.equal(data.value.regeneratedTurn, 3);
  assert.equal(messages.length, 1);
  assert.ok(messages[0].content[0].text.includes('be concise'));
});

test('regenerate route validates the payload and guards origin', async () => {
  const { handler } = makeHandler({ agents: { get: () => agentWith(sampleEvents).agent } });
  for (const body of [
    { turn: 1 },
    { sessionId: 's', turn: 0 },
    { sessionId: 's', turn: 'x' },
    { sessionId: 's', note: '   ' },
  ]) {
    const { res, data } = await invoke(handler, body, { url: '/api/dsh-regenerate/regenerate' });
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(data.error.code, 'bad-request');
  }
  const foreign = await invoke(handler, { sessionId: 's' }, {
    url: '/api/dsh-regenerate/regenerate',
    headers: { host: 'evil.example', origin: 'https://evil.example' },
  });
  assert.equal(foreign.res.statusCode, 403);
  assert.equal(foreign.data.error.code, 'forbidden');
});

test('regenerate route reports a failed injection as 500', async () => {
  const { handler } = makeHandler({ agents: undefined });
  const { res, data } = await invoke(handler, { sessionId: 'sess' }, {
    url: '/api/dsh-regenerate/regenerate',
  });
  assert.equal(res.statusCode, 500);
  assert.equal(data.error.code, 'regenerate-failed');
});
