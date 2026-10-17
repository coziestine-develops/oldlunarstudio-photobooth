/** QR codes for OldLunar. Generated on the device; nothing is uploaded. */
import QRCode from 'qrcode';

/* Where the code points. Photos never leave the device, so the code links to the app itself. */
export const OLDLUNAR_URL = 'https://oldlunarstudio-photobooth.vercel.app/';

const QR_PINK = '#D93A64';
const matrixCache = new Map();

/** Module grid for `text` (true = dark). Cached, so the strip export can redraw it cheaply. */
export function qrMatrix(text = OLDLUNAR_URL) {
  if (matrixCache.has(text)) return matrixCache.get(text);
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const grid = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!modules.get(r, c)));
  matrixCache.set(text, grid);
  return grid;
}

/** Loads a data URL into an image element. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not draw the QR code'));
    img.src = src;
  });
}

/**
 * PNG data URL of the code, for the share panel and its download.
 * A white band under the code carries the studio name, so the code is labelled without
 * covering any modules (text over the code would stop phones from scanning it).
 */
export async function qrDataUrl(text = OLDLUNAR_URL, px = 640) {
  // Pink modules on a pure white background. The pink is a deeper shade of the brand #EB6380
  // so the code keeps enough contrast for phone cameras to scan it reliably.
  const code = await QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 4, width: px, color: { dark: QR_PINK, light: '#FFFFFF' } });
  const img = await loadImage(code);

  // Use the brand font when it is loaded; fall back to the system font otherwise.
  try { await document.fonts?.load?.('700 40px Poppins'); } catch { /* ignore */ }

  const labelH = Math.round(px * 0.15);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height + labelH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  ctx.fillStyle = QR_PINK;
  ctx.font = `700 ${Math.round(px * 0.075)}px Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OLDLUNAR STUDIO', canvas.width / 2, img.height + labelH / 2);
  return canvas.toDataURL('image/png');
}
