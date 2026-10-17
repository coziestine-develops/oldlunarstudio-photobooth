/**
 * PhotoPop Presets — real pixel treatments for captured photos.
 *
 * Each preset is applied to the pixels themselves (not a CSS filter), so the
 * look is identical in every browser and is baked into the downloaded image.
 * The original captured photos are never modified: treatments always produce
 * a new canvas.
 */

export const PRESETS = [
  { id: 'classic', label: 'Classic Photo Booth', note: 'Crisp black & white',
    fx: { sat: 0, contrast: 1.14 } },
  { id: 'vintage', label: 'Vintage Film', note: 'Faded, sepia, grain',
    fx: { sepia: 0.4, lift: 24, contrast: 0.92, tint: [10, 4, -8], grain: 12, vignette: 0.22 } },
  { id: 'warm', label: 'Warm Retro', note: 'Golden and sun-kissed',
    fx: { sat: 1.12, contrast: 1.04, tint: [18, 6, -16] } },
  { id: 'pastel', label: 'Soft Pastel', note: 'Light, airy, dreamy',
    fx: { lift: 38, sat: 0.7, contrast: 0.84, brightness: 8, tint: [12, 0, 10] } },
  { id: 'moody', label: 'Dark Moody', note: 'Deep shadows, cool tones',
    fx: { contrast: 1.28, sat: 0.72, brightness: -16, tint: [-6, 0, 14], vignette: 0.42 } },
  { id: 'minimal', label: 'Clean Minimal', note: 'Bright, soft, neutral',
    fx: { sat: 0.82, contrast: 0.96, brightness: 12, lift: 8 } },
  { id: 'y2k', label: 'Y2K Flash', note: 'Punchy pink and neon',
    fx: { sat: 1.5, contrast: 1.22, brightness: 6, tint: [20, -8, 22], grain: 8 } },
];

export const PRESET_MAP = Object.fromEntries(PRESETS.map(p => [p.id, p]));
export const DEFAULT_PRESET = 'classic';

const clamp = v => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Stable pseudo-random value in [-0.5, 0.5) for pixel index i (grain that does not shimmer between renders). */
function noise(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) - 0.5;
}

/**
 * Apply a preset to a canvas. Returns a NEW canvas; `src` is not modified.
 * Works at any size, so the same function serves thumbnails and full previews.
 */
export function treatCanvas(src, preset) {
  const w = src.width, h = src.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const fx = preset.fx;
  const sat = fx.sat ?? 1, contrast = fx.contrast ?? 1, bright = fx.brightness ?? 0;
  const lift = fx.lift ?? 0, sepia = fx.sepia ?? 0, grain = fx.grain ?? 0;
  const vig = fx.vignette ?? 0, tint = fx.tint;
  const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy) || 1;

  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];

      if (sepia) {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * sepia; g += (sg - g) * sepia; b += (sb - b) * sepia;
      }

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sat;
      g = gray + (g - gray) * sat;
      b = gray + (b - gray) * sat;

      r += bright; g += bright; b += bright;
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;

      if (lift) {
        r = lift + r * (255 - lift) / 255;
        g = lift + g * (255 - lift) / 255;
        b = lift + b * (255 - lift) / 255;
      }

      if (tint) { r += tint[0]; g += tint[1]; b += tint[2]; }

      if (grain) {
        const n = noise(i) * grain * 2;
        r += n; g += n; b += n;
      }

      if (vig) {
        const k = 1 - vig * Math.pow(Math.hypot(x - cx, y - cy) / maxD, 2);
        r *= k; g *= k; b *= k;
      }

      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Load a captured photo (blob or data URL) into a canvas, capped at `maxDim` on its long side. */
export function loadSource(url, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * r));
      c.height = Math.max(1, Math.round(img.naturalHeight * r));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error('Could not read a captured photo'));
    img.src = url;
  });
}

/** Smaller copy of a canvas (used for preset thumbnails). */
export function downscale(src, maxW) {
  if (src.width <= maxW) return src;
  const r = maxW / src.width;
  const c = document.createElement('canvas');
  c.width = maxW; c.height = Math.max(1, Math.round(src.height * r));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * Procedural sunset stand-in shown on the style screen before any photo exists.
 * `variant` shifts the sun so the four sample slots look different.
 */
export function makeSample(variant = 0) {
  const w = 800, h = 600;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#F6D6DD');
  g.addColorStop(0.55, '#EB6380');
  g.addColorStop(1, '#581F1F');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const xs = [0.3, 0.5, 0.68, 0.42];
  ctx.fillStyle = '#F2EBE7';
  ctx.beginPath();
  ctx.arc(w * (xs[variant % 4]), h * 0.42, h * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(58,20,20,0.85)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 1.02, w * 0.42, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
