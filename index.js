/** Host half of dsh-regenerate.
 *
 * The Client half owns all rendering and drives `session/fork` + `session/prompt`
 * through the generated Remotes. It can also read image bytes back with the
 * built-in `session/attachment` Remote and inline them as base64.
 *
 * File attachments are different: `session/prompt` accepts them only as a
 * `receiptId` staged on the *target* Agent, and there is no Client-side route
 * that reads a stored file's bytes. This half therefore exposes one narrow
 * POST route that streams the original file objects into the freshly forked
 * Session's upload intake and returns the resulting receipt ids.
 */
const ROUTE = '/api/dsh-regenerate';

function json(res, value, status) {
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
      if (!sameOrigin(req)) return json(res, { error: 'forbidden' }, 403);

      let payload;
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
          return json(res, { error: (error && error.message) || String(error) }, 502);
        }
      }
      return json(res, { receiptIds }, 200);
    },
  }), 'dsh-regenerate: attachment route');
}
