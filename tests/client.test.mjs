import test from 'node:test';
// Loose assert: VM-realm objects fail strict prototype checks, so deep
// comparisons are structural; identity checks use assert.equal.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

// Load the browser bundle in a VM with a minimal window/document stub and
// expose the factory's inner helpers for direct behavioral tests.
function loadClient(overrides = {}) {
  let factory;
  const style = {
    textContent: '',
    setAttribute(name, value) { this[name] = value; },
    remove() { this.removed = true; },
  };
  const sandbox = {
    window: { __ModuleLoader__: { load(mod) { factory = mod.factory; } } },
    document: {
      head: { appendChild(el) { sandbox.document.head.lastAppended = el; } },
      createElement() { return style; },
      addEventListener() {},
      removeEventListener() {},
    },
    crypto: { randomUUID: () => 'uuid-fixed' },
    fetch: async () => ({ ok: false }),
    Intl,
    URLSearchParams,
    console,
    ...overrides,
  };
  vm.createContext(sandbox);
  const exposed = 'nodeList, textOf, format, attachmentBlocksOf, attachmentCounts, '
    + 'userNodeFor, userNodeBySource, imageParts, fileParts, draftParts, '
    + 'buildContent, promptPayload, sendPrompt, appendInSession, uploadDraft, '
    + 'imageMediaTypeOf, newRequestId';
  const instrumented = source.replace(
    '    let CTX = null;',
    '    let CTX = null;\n    window.__helpers__ = { ' + exposed + ' };',
  );
  assert.notEqual(instrumented, source, 'helper exposure anchor must exist');
  vm.runInContext(instrumented, sandbox, { filename: 'client.js' });
  assert.equal(typeof factory, 'function');
  return { factory, style, sandbox };
}

const noop = () => {};
const react = new Proxy({}, {
  get: (_target, key) => (key === 'Fragment' ? Symbol('Fragment') : noop),
});
const requireStub = (name) => {
  if (name === 'react') return react;
  if (name === 'react-dom') return { createPortal: noop };
  throw new Error('unexpected require: ' + name);
};

function applyClient(factory) {
  const mod = factory(requireStub);
  const registrations = [];
  const locales = [];
  const effects = [];
  const ctx = {
    effect(fn, label) { effects.push({ fn, label }); fn(); return () => {}; },
    locale: { register(ns, dict) { locales.push({ ns, dict }); } },
    slots: {
      inject(name, fn) { fn(); },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
    sessions: {},
    uiWorkspace: {},
    remote: { session: {} },
  };
  mod.apply(ctx);
  return { mod, registrations, locales, effects };
}

test('client bundle exposes the expected module contract', () => {
  const { factory } = loadClient();
  const mod = factory(requireStub);
  assert.equal(mod.name, 'dsh-regenerate');
  assert.deepEqual([...mod.inject], [
    'slots', 'locale', 'sessions', 'uiConversation',
    'uiWorkspace', 'remote', 'remote.session',
  ]);
});

test('client registers two chat slots, dictionaries, and a stylesheet', () => {
  const { factory, style } = loadClient();
  const { registrations, locales, effects } = applyClient(factory);
  assert.deepEqual([...registrations.map((entry) => entry.options.name)], [
    'conversation.chat.assistant-actions',
    'conversation.chat.user.before',
  ]);
  assert.equal(typeof registrations[0].component, 'function');
  assert.equal(typeof registrations[1].component, 'function');
  assert.equal(registrations[0].options.order, 50);
  assert.equal(locales.length, 1);
  assert.equal(locales[0].ns, 'dshRegenerate');
  assert.equal(locales[0].dict.zh.regenerate, '重新生成');
  assert.equal(locales[0].dict.en.regenerate, 'Regenerate');
  assert.equal(effects.length, 2);
  assert.ok(style.textContent.includes('[data-rg-editor]'));
});

test('every locale dictionary covers the same keys', () => {
  const { factory } = loadClient();
  const { locales } = applyClient(factory);
  const dict = locales[0].dict;
  const keys = Object.keys(dict.en).sort();
  assert.ok(keys.length > 10);
  for (const [lang, table] of Object.entries(dict)) {
    assert.deepEqual(Object.keys(table).sort(), keys, lang);
  }
});

test('locale/*.json ui keys are all covered by the inline dictionaries', () => {
  const { factory } = loadClient();
  const { locales } = applyClient(factory);
  const dict = locales[0].dict;
  for (const lang of ['en', 'zh']) {
    const file = JSON.parse(readFileSync(new URL('../locale/' + lang + '.json', import.meta.url), 'utf8'));
    for (const key of Object.keys(file.ui)) {
      assert.ok(Object.prototype.hasOwnProperty.call(dict[lang], key), lang + '.' + key);
    }
    for (const [key, value] of Object.entries(file.ui)) {
      assert.equal(dict[lang][key], value, lang + '.' + key);
    }
  }
});

test('user.before select only claims user-owned seats', () => {
  const { factory } = loadClient();
  const { registrations } = applyClient(factory);
  const select = registrations[1].options.select;
  const source = {};
  assert.equal(select({ kind: 'user', source }).source, source);
  assert.equal(select({ kind: 'assistant', source }), null);
  assert.equal(select(null), null);
});

// ---- helper behavior ----

const userNode = {
  kind: 'user',
  data: {
    source: { seq: 2 },
    content: [
      { type: 'text', text: 'hello' },
      { type: 'image', attachment: { attachmentId: 'img-1', mediaType: 'image/png', name: 'p.png' } },
      { type: 'file', attachment: { attachmentId: 'f-1', name: 'a.txt' } },
      { type: 'text', text: 'world' },
    ],
  },
};
const assistantNode = { kind: 'assistant', data: { closing: { finalNode: { messageId: 'm-1' } } } };
const snapshot = { order: ['u', 'a'], nodes: new Map([['u', userNode], ['a', assistantNode]]) };

function helpers(overrides) {
  const { factory, sandbox } = loadClient(overrides);
  factory(requireStub); // the factory body installs the helper exports
  return sandbox.window.__helpers__;
}

test('nodeList honors order and falls back to map values', () => {
  const H = helpers();
  assert.deepEqual(H.nodeList(snapshot), [userNode, assistantNode]);
  assert.deepEqual(H.nodeList({ nodes: new Map([['u', userNode]]) }), [userNode]);
  assert.deepEqual(H.nodeList(null), []);
});

test('textOf joins text parts and tolerates plain strings', () => {
  const H = helpers();
  assert.equal(H.textOf(userNode), 'hello\nworld');
  assert.equal(H.textOf({ data: { content: 'plain' } }), 'plain');
  assert.equal(H.textOf(null), '');
});

test('attachmentBlocksOf and attachmentCounts split images from files', () => {
  const H = helpers();
  const blocks = H.attachmentBlocksOf(userNode);
  assert.equal(blocks.length, 2);
  assert.deepEqual(H.attachmentCounts(blocks), { images: 1, files: 1, total: 2 });
  assert.deepEqual(H.attachmentBlocksOf({ data: { content: 'x' } }), []);
});

test('format fills positional placeholders and keeps unknown ones', () => {
  const H = helpers();
  assert.equal(H.format('a {0} b {1}', 1, 2), 'a 1 b 2');
  assert.equal(H.format('a {0} b {1}', 1), 'a 1 b {1}');
});

test('userNodeFor resolves the prompt behind a finalized answer, with fallback', () => {
  const H = helpers();
  assert.equal(H.userNodeFor(snapshot, 'm-1'), userNode);
  assert.equal(H.userNodeFor(snapshot, 'unknown'), userNode); // last user message
  assert.equal(H.userNodeFor({ nodes: new Map() }, 'm-1'), null);
});

test('userNodeBySource matches the seat source object by identity', () => {
  const H = helpers();
  assert.equal(H.userNodeBySource(snapshot, userNode.data.source), userNode);
  assert.equal(H.userNodeBySource(snapshot, {}), null);
});

test('imageParts inlines readable images and counts unreadable ones', async () => {
  const H = helpers();
  const blocks = H.attachmentBlocksOf(userNode);
  const okCtx = { remote: { session: { attachment: async () => ({
    ok: true, value: { attachment: { mediaType: 'image/png', name: 'p.png' }, data: 'BASE64' },
  }) } } };
  const good = await H.imageParts(okCtx, 's-1', blocks);
  assert.deepEqual(good.parts, [{ type: 'image', mediaType: 'image/png', data: 'BASE64', name: 'p.png' }]);
  assert.equal(good.missing, 0);
  const badCtx = { remote: { session: { attachment: async () => { throw new Error('gone'); } } } };
  const bad = await H.imageParts(badCtx, 's-1', blocks);
  assert.deepEqual(bad.parts, []);
  assert.equal(bad.missing, 1);
});

test('fileParts posts refs to the host bridge and maps receipts, or reports missing', async () => {
  const calls = [];
  const okFetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ receiptIds: ['r-9'] }) };
  };
  const H = helpers({ fetch: okFetch });
  const blocks = H.attachmentBlocksOf(userNode);
  const good = await H.fileParts('s-2', blocks);
  assert.deepEqual(good, { parts: [{ type: 'file', receiptId: 'r-9' }], missing: 0 });
  assert.equal(calls[0].url, '/api/dsh-regenerate');
  assert.equal(calls[0].init.credentials, 'same-origin');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.childSessionId, 's-2');
  assert.deepEqual(body.files, [{ attachmentId: 'f-1', name: 'a.txt' }]);

  const down = helpers({ fetch: async () => ({ ok: false }) });
  assert.deepEqual(await down.fileParts('s-2', blocks), { parts: [], missing: 1 });
  const offline = helpers({ fetch: async () => { throw new Error('offline'); } });
  assert.deepEqual(await offline.fileParts('s-2', blocks), { parts: [], missing: 1 });
  assert.deepEqual(await H.fileParts('s-2', []), { parts: [], missing: 0 });
});

test('promptPayload carries a request id, queue mode, and time zone', () => {
  const H = helpers();
  const payload = H.promptPayload('s-1', [{ type: 'text', text: 'x' }]);
  assert.equal(payload.sessionId, 's-1');
  assert.equal(payload.mode, 'queue');
  assert.equal(payload.requestId, 'uuid-fixed');
  assert.ok(payload.clientTimeZone);
});

test('sendPrompt throws the remote error message on rejection', async () => {
  const H = helpers({ AbortController });
  const failCtx = { remote: { session: { prompt: async () => ({ ok: false, error: { message: 'busy' } }) } } };
  await assert.rejects(() => H.sendPrompt(failCtx, 's', []), /busy/);
  const okCtx = { remote: { session: { prompt: async () => ({ ok: true }) } } };
  await H.sendPrompt(okCtx, 's', []);
});

test('appendInSession refuses an empty prompt but allows attachment-only prompts', async () => {
  const H = helpers({ AbortController, fetch: async () => ({ ok: false }) });
  const sent = [];
  const ctx = { remote: { session: {
    prompt: async (payload) => { sent.push(payload); return { ok: true }; },
    attachment: async () => ({ ok: false }),
  } } };
  await assert.rejects(() => H.appendInSession(ctx, 's-1', null, '   '), /empty/);
  const outcome = await H.appendInSession(ctx, 's-1', userNode, '');
  assert.ok(outcome.missing > 0); // unreadable attachments are reported, not dropped silently
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sessionId, 's-1');
  assert.equal(sent[0].content.length, 0);
});

test('appendInSession rebuilds text plus carried attachments in the same session', async () => {
  const H = helpers({
    AbortController,
    fetch: async () => ({ ok: true, json: async () => ({ receiptIds: ['r-file'] }) }),
  });
  const sent = [];
  const ctx = { remote: { session: {
    prompt: async (payload) => { sent.push(payload); return { ok: true }; },
    attachment: async () => ({ ok: true, value: { attachment: { mediaType: 'image/png' }, data: 'B64' } }),
  } } };
  const outcome = await H.appendInSession(ctx, 's-1', userNode, 'edited');
  assert.equal(outcome.missing, 0);
  const content = sent[0].content;
  assert.deepEqual(content.map((p) => p.type), ['text', 'image', 'file']);
  assert.equal(content[0].text, 'edited');
  assert.equal(content[2].receiptId, 'r-file');
});

test('draftParts reuses per-session receipts and uploads only once', async () => {
  let uploads = 0;
  const H = helpers({
    FileReader: class {
      readAsArrayBuffer() { this.result = new ArrayBuffer(2); queueMicrotask(() => this.onload()); }
    },
    fetch: async (url) => {
      uploads += 1;
      assert.ok(url.startsWith('/api/session/uploadFileBinary?'));
      assert.ok(url.includes('sessionId=s-1'));
      return { ok: true, json: async () => ({ ok: true, value: { receiptId: 'r-draft' } }) };
    },
  });
  const draft = { file: { name: 'n.txt', type: 'text/plain' }, receipts: {} };
  const first = await H.draftParts('s-1', [draft]);
  assert.deepEqual(first, { parts: [{ type: 'file', receiptId: 'r-draft' }], missing: 0 });
  const second = await H.draftParts('s-1', [draft]);
  assert.deepEqual(second.parts, first.parts);
  assert.equal(uploads, 1); // receipt cached on the draft
  const failed = helpers({
    FileReader: class { readAsArrayBuffer() { queueMicrotask(() => this.onerror()); } },
  });
  const bad = await failed.draftParts('s-1', [{ file: { name: 'x', type: '' }, receipts: {} }]);
  assert.deepEqual(bad, { parts: [], missing: 1 });
});

test('imageMediaTypeOf accepts only the composer image types', () => {
  const H = helpers();
  assert.equal(H.imageMediaTypeOf({ type: 'image/png' }), 'image/png');
  assert.equal(H.imageMediaTypeOf({ type: 'image/svg+xml' }), null);
  assert.equal(H.imageMediaTypeOf({ type: 'application/pdf' }), null);
});
