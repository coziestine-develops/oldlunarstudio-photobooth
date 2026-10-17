/**
 * GET /api/download/<file> — downloads a shared strip while its 24-hour window is open.
 *
 * The strip is a PRIVATE blob, so this function reads it and streams it to the phone with a
 * download header. Expiry is checked here too, so a link stops working on time even before the
 * cleanup job deletes the file.
 */
import { get } from '@vercel/blob';
import { Readable } from 'node:stream';
import { PREFIX, isExpired } from '../../lib/strips.js';

function page(res, status, title, text) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
    `<body style="font-family:system-ui,sans-serif;background:#191516;color:#F2EBE7;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">` +
    `<div><h1 style="font-size:1.4rem">${title}</h1><p>${text}</p></div></body>`
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const name = String(req.query.name || '');
  if (!/^\d{13}-[0-9a-f-]{36}\.(jpg|png)$/.test(name)) {
    return page(res, 404, 'Link not found', 'This download link is not valid.');
  }
  if (isExpired(name)) {
    return page(res, 410, 'This link has expired', 'Shared strips are available for 24 hours. Ask for a new QR code.');
  }

  let result;
  try {
    result = await get(PREFIX + name, { access: 'private' });
  } catch (err) {
    console.error('download: could not read strip', err);
    return page(res, 500, 'Something went wrong', 'The strip could not be loaded right now. Please try again in a moment.');
  }
  if (!result || result.statusCode !== 200 || !result.stream) {
    return page(res, 404, 'Link not found', 'This strip has been removed.');
  }

  const isPng = name.endsWith('.png');
  res.statusCode = 200;
  res.setHeader('Content-Type', isPng ? 'image/png' : 'image/jpeg');
  res.setHeader('Content-Disposition', `attachment; filename="oldlunar-strip.${isPng ? 'png' : 'jpg'}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'HEAD') return res.end();

  Readable.fromWeb(result.stream).on('error', () => res.destroy()).pipe(res);
}
