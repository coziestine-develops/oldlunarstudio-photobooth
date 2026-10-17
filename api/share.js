/**
 * POST /api/share — stores one strip image and returns a link that downloads it.
 *
 * The body is the raw image (Content-Type image/jpeg or image/png). The file is stored
 * as a PRIVATE blob (nobody can open its address directly). The returned downloadUrl
 * points at /api/download/<file>, which streams the file to the phone as a download and
 * stops working after 24 hours (see lib/strips.js).
 *
 * Needs a Blob store connected to the Vercel project (sets BLOB_READ_WRITE_TOKEN).
 */
import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { PREFIX, TTL_MS } from '../lib/strips.js';

const MAX_BYTES = 4 * 1024 * 1024;           // Vercel functions accept request bodies up to ~4.5 MB
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' };

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const err = new Error('File too large');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return res.status(415).json({ error: 'Unsupported file type' });

  // Without a connected Blob store there is nowhere to keep the strip. Say so clearly instead of a generic 500.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('share: BLOB_READ_WRITE_TOKEN is missing — connect a Blob store to this Vercel project');
    return res.status(503).json({ error: 'Storage is not connected', code: 'storage_not_connected' });
  }

  try {
    const body = await readBody(req, MAX_BYTES);
    if (!body.length) return res.status(400).json({ error: 'Empty file' });

    const uploadedAt = Date.now();
    const file = `${uploadedAt}-${randomUUID()}.${ext}`;
    await put(PREFIX + file, body, {
      access: 'private',
      contentType: type,
      addRandomSuffix: false,
    });

    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    return res.status(201).json({
      downloadUrl: `${proto}://${host}/api/download/${file}`,
      expiresAt: new Date(uploadedAt + TTL_MS).toISOString(),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('share upload failed', err);
    if (status >= 500 && /access|private|public/i.test(String(err?.message))) {
      // the Blob store exists but rejects this kind of upload (e.g. a public-only store)
      return res.status(500).json({ error: 'Storage rejected the upload', code: 'store_access_mismatch' });
    }
    return res.status(status).json({ error: status === 413 ? 'File too large' : 'Upload failed', code: status === 413 ? 'too_large' : 'upload_failed' });
  }
}
