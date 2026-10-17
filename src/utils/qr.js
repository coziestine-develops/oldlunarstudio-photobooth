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

/** PNG data URL of the code, for the share panel and its download. */
export function qrDataUrl(text = OLDLUNAR_URL, px = 640) {
  // Pink modules on a pure white background. The pink is a deeper shade of the brand #EB6380
  // so the code keeps enough contrast for phone cameras to scan it reliably.
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 4, width: px, color: { dark: QR_PINK, light: '#FFFFFF' } });
}