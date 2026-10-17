/**
 * OldLunar — 8 Filters (Normal + 7 colour grades)
 *
 * Every filter is a pure colour grade (tone curve, split-toning, gentle
 * saturation, optional bloom / grain / vignette). Nothing blurs, warps or
 * retouches the image, so facial features, skin texture, hairstyle and
 * identity are never altered.
 *
 * Filters are NON-DESTRUCTIVE: photos are captured untouched and the filter
 * is applied at preview / export time with an intensity from 0–100 %.
 *
 *   apply(ctx, w, h, intensity = 1)   canvas pixel processing
 *   css(intensity)                    CSS approximation (thumbnails)
 */

const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* Parameters per filter.
 *  exposure   multiplier on brightness (1 = unchanged)
 *  contrast   1 = unchanged
 *  saturation 1 = unchanged
 *  fade       lifts the blacks (0–40)
 *  warmth     + warms (red up / blue down), − cools
 *  tint       + magenta, − green
 *  shadow     [r,g,b] colour pushed into shadows
 *  highlight  [r,g,b] colour pushed into highlights
 *  split      strength of the shadow/highlight toning (0–1)
 *  glow       soft bloom amount on highlights (0–1)
 *  glowColor  colour of the bloom
 *  vignette   edge darkening (0–1)
 *  grain      film grain amplitude
 */
const PARAMS = {
  normal: { identity: true },

  retro: {
    exposure: 1.02, contrast: 0.92, saturation: 0.80, fade: 24,
    warmth: 15, tint: -3,
    shadow: [60, 74, 78], highlight: [255, 226, 178], split: 0.20,
    glow: 0, glowColor: [255, 220, 170], vignette: 0.22, grain: 22,
  },

  mono: {
    exposure: 1.02, contrast: 1.10, saturation: 0, fade: 6,
    warmth: 0, tint: 0,
    shadow: [0, 0, 0], highlight: [255, 255, 255], split: 0,
    glow: 0, glowColor: [255, 255, 255], vignette: 0.14, grain: 8,
  },

  warm: {
    exposure: 1.06, contrast: 1.04, saturation: 1.10, fade: 6,
    warmth: 22, tint: 0,
    shadow: [120, 66, 40], highlight: [255, 210, 130], split: 0.24,
    glow: 0.18, glowColor: [255, 190, 100], vignette: 0.16, grain: 0,
  },

  vivid: {
    exposure: 1.04, contrast: 1.12, saturation: 1.38, fade: 0,
    warmth: 2, tint: 0,
    shadow: [0, 0, 0], highlight: [255, 255, 255], split: 0,
    glow: 0, glowColor: [255, 255, 255], vignette: 0.06, grain: 0,
  },

  sweet: {
    exposure: 1.05, contrast: 0.94, saturation: 0.96, fade: 10,
    warmth: 4, tint: 8,
    shadow: [96, 70, 122], highlight: [255, 214, 232], split: 0.16,
    glow: 0.30, glowColor: [255, 196, 224], vignette: 0.10, grain: 0,
  },

  noir: {
    exposure: 0.95, contrast: 1.28, saturation: 0.62, fade: 0,
    warmth: -12, tint: 0,
    shadow: [14, 24, 44], highlight: [205, 216, 232], split: 0.22,
    glow: 0, glowColor: [190, 210, 255], vignette: 0.42, grain: 5,
  },

  vintage: {
    exposure: 0.99, contrast: 0.88, saturation: 0.70, fade: 30,
    warmth: 18, tint: 6,
    shadow: [70, 58, 48], highlight: [250, 224, 184], split: 0.30,
    glow: 0.08, glowColor: [255, 220, 170], vignette: 0.30, grain: 16,
  },
};

/** Soft blur without ctx.filter (works on Safari): down-scale then up-scale. */
function softBlurCanvas(src, w, h, divisor = 10) {
  const sw = Math.max(8, Math.round(w / divisor));
  const sh = Math.max(8, Math.round(h / divisor));
  const small = document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, sw, sh);
  const big = document.createElement('canvas');
  big.width = w; big.height = h;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, w, h);
  return big;
}

function gradeImage(ctx, w, h, p, k) {
  const exposure   = lerp(1, p.exposure   ?? 1, k);
  const contrast   = lerp(1, p.contrast   ?? 1, k);
  const saturation = lerp(1, p.saturation ?? 1, k);
  const fade       = (p.fade   ?? 0) * k;
  const warmth     = (p.warmth ?? 0) * k;
  const tint       = (p.tint   ?? 0) * k;
  const split      = (p.split  ?? 0) * k;
  const sh = p.shadow ?? [0, 0, 0];
  const hi = p.highlight ?? [255, 255, 255];

  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * exposure, g = d[i + 1] * exposure, b = d[i + 2] * exposure;

    // Contrast around mid-grey
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // Saturation (luma-preserving)
    const l0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = l0 + (r - l0) * saturation;
    g = l0 + (g - l0) * saturation;
    b = l0 + (b - l0) * saturation;

    // Warmth / tint
    r += warmth;          b -= warmth;
    g -= tint * 0.6;      r += tint * 0.25;  b += tint * 0.25;

    // Split-toning (shadows → one colour, highlights → another)
    if (split > 0) {
      const l = clamp255(0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const ws = (1 - l) * (1 - l) * split;
      const wh = l * l * split;
      r = r + (sh[0] - r) * ws + (hi[0] - r) * wh * 0.55;
      g = g + (sh[1] - g) * ws + (hi[1] - g) * wh * 0.55;
      b = b + (sh[2] - b) * ws + (hi[2] - b) * wh * 0.55;
    }

    // Faded blacks
    if (fade > 0) {
      r = r + (fade - r * fade / 255);
      g = g + (fade - g * fade / 255);
      b = b + (fade - b * fade / 255);
    }

    d[i] = clamp255(r); d[i + 1] = clamp255(g); d[i + 2] = clamp255(b);
  }
  ctx.putImageData(id, 0, 0);
}

/** Highlight bloom: blurred copy, screen-blended at low opacity. */
function addGlow(ctx, w, h, amount, color) {
  if (amount <= 0) return;
  const blur = softBlurCanvas(ctx.canvas, w, h, 9);
  const bctx = blur.getContext('2d');
  bctx.globalCompositeOperation = 'multiply';
  bctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  bctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = amount * 0.55;
  ctx.drawImage(blur, 0, 0);
  ctx.restore();
}

function addVignette(ctx, w, h, strength) {
  if (strength <= 0) return;
  const cx = w / 2, cy = h / 2, r = Math.hypot(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function addGrain(ctx, w, h, amount) {
  if (amount <= 0) return;
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = clamp255(d[i] + n); d[i + 1] = clamp255(d[i + 1] + n); d[i + 2] = clamp255(d[i + 2] + n);
  }
  ctx.putImageData(id, 0, 0);
}

function applyParams(p, ctx, w, h, intensity = 1) {
  if (p.identity) return;
  const k = Math.max(0, Math.min(1, intensity));
  if (k === 0) return;
  gradeImage(ctx, w, h, p, k);
  addGlow(ctx, w, h, (p.glow ?? 0) * k, p.glowColor ?? [255, 255, 255]);
  addVignette(ctx, w, h, (p.vignette ?? 0) * k);
  addGrain(ctx, w, h, (p.grain ?? 0) * k);
}

/** CSS approximation (thumbnails; interpolated by intensity). */
function cssFor(p, k = 1) {
  if (p.identity) return 'none';
  const b = lerp(1, p.exposure ?? 1, k).toFixed(3);
  const c = lerp(1, p.contrast ?? 1, k).toFixed(3);
  const s = lerp(1, p.saturation ?? 1, k).toFixed(3);
  const sep = (Math.max(0, p.warmth ?? 0) / 100) * k;
  const hue = ((p.tint ?? 0) * -0.35 - (p.warmth ?? 0) * 0.15) * k;
  return `brightness(${b}) contrast(${c}) saturate(${s}) sepia(${sep.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)`;
}

function make(id, label, emoji, tagline, accent) {
  const p = PARAMS[id];
  return {
    id, label, emoji, tagline, accent,
    css: cssFor(p, 1),
    cssAt: k => cssFor(p, k),
    apply: (ctx, w, h, intensity = 1) => applyParams(p, ctx, w, h, intensity),
  };
}

export const FILTERS = [
  make('normal',  'Normal',  '⚪', 'Your photo, untouched',            '#F2EBE7'),
  make('retro',   'Retro',   '📸', '90s film: faded, warm and grainy', '#D9A877'),
  make('mono',    'Mono',    '🖤', 'Classic black & white',            '#B8B8B8'),
  make('warm',    'Warm',    '✨', 'Sun-kissed golden highlights',     '#F2B34C'),
  make('vivid',   'Vivid',   '🌈', 'Rich, punchy colour',              '#E8556D'),
  make('sweet',   'Sweet',   '💗', 'Dreamy, soft-pink glow',           '#F4A6C8'),
  make('noir',    'Noir',    '🌑', 'Deep blacks, cool, cinematic',     '#8A97AB'),
  make('vintage', 'Vintage', '🎞️', 'Faded, sepia-toned nostalgia',     '#C8A97E'),
];

export const FILTER_MAP = Object.fromEntries(FILTERS.map(f => [f.id, f]));
export const DEFAULT_FILTER = 'normal';
export const DEFAULT_INTENSITY = 100;
