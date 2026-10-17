/**
 * Download links for the QR code.
 *
 * A QR code can only hold a short link, so the strip itself has to be hosted.
 * uploadStrip() sends a JPEG copy of the strip to /api/share (see api/share.js),
 * which returns a link that makes the phone download the file directly.
 */

export const SHARE_ENDPOINT = import.meta.env.VITE_SHARE_ENDPOINT || '/api/share';
const TIMEOUT_MS = 45000;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;      // matches the server limit
const JPEG_QUALITIES = [0.92, 0.85, 0.75];      // tried in order until the file fits

/** Load a PNG/JPEG blob into an image element. */
function loadBlobImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the strip image')); };
    img.src = url;
  });
}

/** JPEG copy of the finished strip, small enough to upload. Strips have a solid background, so JPEG loses nothing visible. */
export async function toShareJpeg(pngBlob) {
  const img = await loadBlobImage(pngBlob);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  for (const q of JPEG_QUALITIES) {
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the strip'))), 'image/jpeg', q));
    if (blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error('The strip is too large to share. Try fewer or smaller photos.');
}

/** A readable reason for a failed upload. The server's error text is shown only when it is a short, known message. */
export class ShareError extends Error {}

async function explain(res) {
  let body = {};
  try { body = (await res.clone().json()) || {}; } catch { /* not JSON */ }
  if (body.code === 'storage_not_connected') {
    return 'Sharing storage is not connected to this website yet. The site owner needs to add a Blob store in Vercel (Storage → Create → Blob) and connect it to this project, then redeploy. You can still download the strip below.';
  }
  if (body.code === 'store_access_mismatch') {
    return 'The sharing storage rejected the upload. The site owner should check that the Blob store is a private store, then redeploy. You can still download the strip below.';
  }
  if (res.status === 413) return 'The strip is too large to upload. Try fewer or smaller photos.';
  if (res.status === 404 || res.status === 405) {
    return 'The download service is not running at this address. It only works on the published website, not in local development.';
  }
  const detail = typeof body.error === 'string' ? body.error : '';
  if (res.status === 401 || res.status === 403) return 'The download service refused the upload. Check the server settings.';
  if (res.status >= 500) return 'The server could not save the strip right now. Please try again in a moment, or download the strip instead.';
  return detail ? `Upload failed: ${detail}.` : `Upload failed (status ${res.status}).`;
}

/** Uploads the image. Resolves to { url, expiresAt } (expiresAt is an ISO time). Throws a ShareError with a reason on failure. */
export async function uploadStrip(blob) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(SHARE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new ShareError('The upload took too long. Check your connection and try again.');
    throw new ShareError('Could not reach the server. Check your internet connection and try again.');
  }
  clearTimeout(timer);

  if (!res.ok) throw new ShareError(await explain(res));

  let data;
  try { data = await res.json(); }
  catch { throw new ShareError('The server replied in an unexpected format. The download service may not be deployed.'); }
  let url;
  try { url = new URL(data.downloadUrl); }
  catch { throw new ShareError('The server did not return a download link.'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ShareError('The server returned an invalid download link.');
  return { url: url.toString(), expiresAt: data.expiresAt };
}
