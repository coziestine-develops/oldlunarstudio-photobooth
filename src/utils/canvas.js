/**
 * OldLunar — Canvas / Capture Utilities
 *
 */
import { FILTER_MAP } from './filters.js';

/**
 * Capture one frame from a <video> element.
 * Returns a PNG Blob at the video's native resolution (Full HD when the camera supports it).
 */
export async function waitForFrame(videoEl, timeoutMs = 3000) {
  const start = performance.now();
  const ready = () => videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
  while (!ready()) {
    if (videoEl.paused) videoEl.play?.().catch(() => {});
    if (performance.now() - start > timeoutMs) throw new Error('Camera is not ready yet');
    await new Promise(r => setTimeout(r, 50));
  }
}

/** True when the <video> has a decoded frame and real dimensions. */
export function isVideoReady(videoEl) {
  return !!videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
}

/**
 * Grab the CURRENT video frame onto a canvas — fully synchronous, no awaits, no timers.
 * This is what the countdown calls the instant it reaches zero. Encoding to a file
 * happens afterwards (canvasToBlob), so it can never delay the shot.
 */
export function grabFrame(videoEl) {
  if (!isVideoReady(videoEl)) throw new Error('Camera is not ready yet');
  const w = videoEl.videoWidth, h = videoEl.videoHeight;
  // Keep only the part of the camera image that the preview shows (object-fit: cover, centred),
  // so the saved photo matches what the guest sees on screen — including the 4:5 phone preview.
  let sx = 0, sy = 0, sw = w, sh = h;
  const box = videoEl.getBoundingClientRect?.();
  if (box && box.width > 0 && box.height > 0) {
    const want = box.width / box.height, have = w / h;
    if (want < have) { sw = Math.round(h * want); sx = Math.round((w - sw) / 2); }
    else if (want > have) { sh = Math.round(w / want); sy = Math.round((h - sh) / 2); }
  }
  const canvas = document.createElement('canvas');
  canvas.width = sw; canvas.height = sh;
  const ctx = canvas.getContext('2d');
  // No mirroring: the saved photo is exactly the camera image, the same way the preview shows it.
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

/**
 * Instant on-screen stand-in for a just-grabbed frame. Synchronous (a few ms): downscale + JPEG data URL.
 * Shown the moment the shutter fires; the full-resolution PNG replaces it silently once encoded.
 */
export function previewURL(canvas, maxW = 960) {
  const ratio = Math.min(1, maxW / canvas.width);
  const w = Math.max(1, Math.round(canvas.width * ratio)), h = Math.max(1, Math.round(canvas.height * ratio));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(canvas, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.85);
}

/** Decode an image off-screen so swapping it into an <img> never flashes blank. */
export function preDecode(url) {
  const img = new Image();
  img.src = url;
  return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/png'));
}

/** Convenience wrapper (kept for other callers): wait until ready, grab, encode. */
export async function captureFrame(videoEl, filterId = 'normal') {
  await waitForFrame(videoEl);
  const canvas = grabFrame(videoEl);
  // Originals are saved untouched ('normal' = no filter); filters are applied in the editor.
  const filter = FILTER_MAP[filterId];
  if (filter) filter.apply(canvas.getContext('2d'), canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

/** Convert a Blob to a data URL. */
export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Resize an image data URL to a small thumbnail data URL. */
export function resizeDataURL(dataUrl, maxDim = 360) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim/img.width, maxDim/img.height, 1);
      const w = Math.round(img.width*ratio), h = Math.round(img.height*ratio);
      const c = document.createElement('canvas');
      c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      resolve(c.toDataURL('image/jpeg',0.72));
    };
    img.src = dataUrl;
  });
}

/**
 * Apply brightness/contrast/saturation adjustments to a canvas
 * that already has an image drawn on it. Returns the same canvas.
 */
export function applyAdjustments(ctx, w, h, { brightness=100, contrast=100, saturation=100 }) {
  // Use an offscreen canvas with CSS filter then draw back
  const src = ctx.canvas;
  const off = document.createElement('canvas');
  off.width=w; off.height=h;
  const oc = off.getContext('2d');
  oc.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  oc.drawImage(src, 0, 0);
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(off,0,0);
}

/** Generate a timestamped PNG filename. */
export function pngFilename(prefix='oldlunar studio-photostrip') {
  const n=new Date();
  const pad=v=>String(v).padStart(2,'0');
  return `${prefix}-${n.getFullYear()}${pad(n.getMonth()+1)}${pad(n.getDate())}-${pad(n.getHours())}${pad(n.getMinutes())}${pad(n.getSeconds())}.png`;
}

/** Download a Blob as a PNG file, then revoke the object URL. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}