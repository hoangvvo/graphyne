import { QueryBody, parseBodyByContentType } from 'graphyne-core';
import { IncomingMessage } from 'http';

export function parseNodeRequest(
  req: IncomingMessage | (IncomingMessage & { body: any }),
  cb: (err: any, body: QueryBody | null) => void
): void {
  // If body has been parsed as a keyed object, use it.
  let rawBody = '';

  if ('body' in req) {
    if (typeof req.body === 'object') return cb(null, req.body);
    else if (typeof req.body === 'string') rawBody = req.body;
  }

  const oCtype = req.headers['content-type'];
  // Skip requests without content types.
  if (!oCtype) return cb(null, null);

  // parse immediately if req.body is string
  if (rawBody) {
    try {
      cb(null, parseBodyByContentType(rawBody, oCtype));
    } catch (err) {
      err.status = 400;
      cb(err, null);
    }
    return;
  }

  req.on('data', (chunk) => (rawBody += chunk));
  req.on('error', (err) => cb(err, null));
  req.on('end', () => {
    try {
      cb(null, parseBodyByContentType(rawBody, oCtype));
    } catch (err) {
      err.status = 400;
      cb(err, null);
    }
  });
}
