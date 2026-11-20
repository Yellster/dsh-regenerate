import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, inject } from '../index.js';

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
  return { handler, uploads };
}

function request(body, {
  method = 'POST',
  headers = { host: '127.0.0.1:7926' },
} = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    method,
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
