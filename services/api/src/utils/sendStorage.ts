import type { Readable } from 'stream';
import type { Response } from 'express';

/** Stream or send a storage object without buffering entire files in RAM when possible. */
export function sendStorageBody(
  res: Response,
  data: Buffer | Readable | null | undefined,
  opts: { contentType: string; cacheControl?: string; disposition?: string },
): void {
  if (!data) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  res.setHeader('Content-Type', opts.contentType);
  if (opts.cacheControl) res.setHeader('Cache-Control', opts.cacheControl);
  if (opts.disposition) res.setHeader('Content-Disposition', opts.disposition);

  if (Buffer.isBuffer(data)) {
    res.send(data);
    return;
  }

  data.on('error', (err) => {
    console.error('[sendStorageBody]', err);
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
  data.pipe(res);
}
