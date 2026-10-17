/**
 * PhotoPop — composition engine.
 *
 * Every layout is drawn on a plain canvas in logical units (the sizes in SIZE),
 * then scaled for preview (1x) or export (2x). The same function produces what
 * the user sees and what they download, so they always match.
 *
 * Strip layouts are drawn ON TOP OF the chosen template image (public/photopop/<file>),
 * which is used exactly as uploaded: the photos go into the template's photo windows
 * (`frames`) and the template's own artwork and text are left untouched.
 *
 * Postcard and Polaroid are also used by the photo editor (see utils/export.js).
 */

export const WATERMARK = '@oldlunar studio';
export const BURGUNDY = '#581F1F';   // reference background
const WHITE = '#FFFFFF';
const CREAM = '#F2EBE7';
const INK = '#191516';
const FONT = "Poppins, 'Helvetica Neue', Arial, sans-serif";
const HAND = "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive";
const FOOT_GAP = 40;     // space between the last photo and the footer

/* Strip templates. Each file is used exactly as uploaded. `frames` are the photo windows
   measured from that file. The number of photos a session takes equals the number of frames. */
export const STRIP_TEMPLATES = [
  {
    id: 'classic', label: 'Retro Strip', hint: 'A retro strip for timeless memories.', file: 'strip-template.png',
    frames: [
      { x: 60, y: 158, w: 480, h: 326 },
      { x: 60, y: 521, w: 480, h: 326 },
      { x: 60, y: 884, w: 480, h: 326 },
      { x: 60, y: 1247, w: 480, h: 326 },
    ],
  },
  {
    id: 'bw', label: 'Black & White Vintage', hint: 'Timeless memories in vintage frames.', file: 'strip-template1.png',
    frames: [
      { x: 60, y: 192, w: 480, h: 420 },
      { x: 60, y: 635, w: 480, h: 421 },
      { x: 60, y: 1079, w: 480, h: 421 },
    ],
  },
  {
    id: 'cinema', label: 'Cinema Retro', hint: 'Vintage cinematic memories.', file: 'strip-template2.png',
    frames: [
      { x: 73, y: 211, w: 454, h: 553 },
      { x: 73, y: 805, w: 454, h: 553 },
    ],
  },
  {
    id: 'tiny', label: 'Tiny Tales', hint: 'Sweetest cute memories.', file: 'strip-template3.png',
    frames: [
      { x: 60, y: 192, w: 480, h: 420 },
      { x: 60, y: 640, w: 480, h: 421 },
      { x: 60, y: 1098, w: 480, h: 421 },
    ],
  },
];
export const templateUrl = t => `${import.meta.env.BASE_URL}photopop/${t.file}`;

/* ── Layout catalogue ── */
export const LAYOUTS = [
  { id: 'strip', label: 'Classic Strip', hint: 'Stacked frames' },
];
export const LAYOUT_IDS = LAYOUTS.map(l => l.id);

/* Logical canvas sizes (height includes the footer). Strip = the template's own pixel size. */
const SIZE = {
  strip:    { w: 600,  h: 1800 },
  postcard: { w: 1400, h: 1000 },
  polaroid: { w: 1000, h: 1410 },
};

/* ── template loading (cached per template) ── */
const templatePromises = new Map();
/** Loads a strip template once. Resolves to an HTMLImageElement. */
export function loadStripTemplate(id = STRIP_TEMPLATES[0].id) {
  const t = STRIP_TEMPLATES.find(x => x.id === id) ?? STRIP_TEMPLATES[0];
  if (!templatePromises.has(t.id)) {
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { templatePromises.delete(t.id); reject(new Error('Could not load the strip template')); };
      img.src = templateUrl(t);
    });
    templatePromises.set(t.id, p);
  }
  return templatePromises.get(t.id);
}

/* ── primitives ── */

/** Fill a rect with `src`, cropped to cover (never stretched). Null src = the black frame from the reference. */
function drawCover(ctx, src, x, y, w, h) {
  if (!src) { ctx.fillStyle = '#000000'; ctx.fillRect(x, y, w, h); return; }
  const s = Math.max(w / src.width, h / src.height);
  const dw = src.width * s, dh = src.height * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/** Playful slash marks, like the reference's top-left and bottom-right. */
function slashes(ctx, x, y, count, gap, len, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const sx = x + i * gap;
    ctx.beginPath(); ctx.moveTo(sx, y + len); ctx.lineTo(sx + len * 0.45, y); ctx.stroke();
  }
  ctx.restore();
}

/** Watermark line, centred at `top`. k scales the footer (1 = full size). Text only, no QR code. */
function drawFooter(ctx, cx, top, k, ink) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(34 * k)}px ${FONT}`;
  ctx.fillText(WATERMARK, cx, top + 30 * k);
  ctx.restore();
}

/* ── layouts ── */

/** Classic Strip: the chosen template is the base; photos fill its photo windows (opts.frames). */
function drawStrip(ctx, slots, opts) {
  const { w, h } = SIZE.strip;
  if (opts.template) {
    ctx.drawImage(opts.template, 0, 0, w, h);
  } else {
    ctx.fillStyle = BURGUNDY; ctx.fillRect(0, 0, w, h);
  }
  const frames = opts.frames ?? STRIP_TEMPLATES[0].frames;
  frames.forEach((f, i) => drawCover(ctx, slots[i], f.x, f.y, f.w, f.h));
}

function drawPostcard(ctx, slots, opts) {
  const W = SIZE.postcard.w, H = SIZE.postcard.h;
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);

  // photo area: 2 × 2 on the left
  const px = 60, py = 60, pw = 760, ph = 880, gap = 20;
  const cw = (pw - gap) / 2, ch = (ph - gap) / 2;
  for (let i = 0; i < 4; i++) {
    const c = i % 2, r = Math.floor(i / 2);
    drawCover(ctx, slots[i], px + c * (cw + gap), py + r * (ch + gap), cw, ch);
  }

  // right panel: stamp, greeting, message lines, date, footer
  const rx = 880, rw = 460;
  ctx.save();
  ctx.setLineDash([8, 6]); ctx.strokeStyle = BURGUNDY; ctx.lineWidth = 3;
  ctx.strokeRect(1220, 60, 120, 140);
  ctx.setLineDash([]);
  ctx.fillStyle = BURGUNDY; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('OLDLUNAR', 1280, 110);
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(String(new Date().getFullYear()), 1280, 150);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = BURGUNDY; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `700 56px ${FONT}`;
  ctx.fillText('Greetings!', rx, 100);
  ctx.strokeStyle = 'rgba(88,31,31,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const y = 250 + i * 52;
    ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx + rw, y); ctx.stroke();
  }
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(opts.dateText || '', rx, 540);
  ctx.restore();

  drawFooter(ctx, rx + rw / 2, 720, 0.75, BURGUNDY);
}

function drawPolaroid(ctx, slots, opts) {
  const W = SIZE.polaroid.w, H = SIZE.polaroid.h;
  const cardW = 400, cardH = 470, photo = 340, side = 30;
  const rotations = [-0.03, 0.025, 0.02, -0.025];
  ctx.fillStyle = BURGUNDY; ctx.fillRect(0, 0, W, H);
  slashes(ctx, 24, 16, 5, 22, 40, WHITE);
  const captions = opts.captions || [];

  for (let i = 0; i < 4; i++) {
    const c = i % 2, r = Math.floor(i / 2);
    const x = 80 + c * (cardW + 40), y = 70 + r * (cardH + 40);
    ctx.save();
    ctx.translate(x + cardW / 2, y + cardH / 2);
    ctx.rotate(rotations[i]);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fillStyle = WHITE;
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
    ctx.shadowColor = 'transparent';
    drawCover(ctx, slots[i], -cardW / 2 + side, -cardH / 2 + side, photo, photo);
    const text = (captions[i] || '').trim();
    if (text) {
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `500 40px ${HAND}`;
      ctx.fillText(text, 0, -cardH / 2 + side + photo + (cardH - side - photo) / 2);
    }
    ctx.restore();
  }
  const contentBottom = 70 + 2 * cardH + 40;
  drawFooter(ctx, W / 2, contentBottom + FOOT_GAP, 1, WHITE);
}

const DRAW = { strip: drawStrip, postcard: drawPostcard, polaroid: drawPolaroid };

/**
 * Render a layout to a new canvas.
 * @param layoutId  'strip' | 'postcard' | 'polaroid'
 * @param slots     treated photos, one per frame; null = empty black frame
 * @param opts      { scale = 1, captions = [], dateText = '', template = null, frames = null }
 */
export function composeImage(layoutId, slots, opts = {}) {
  const id = DRAW[layoutId] ? layoutId : 'strip';
  const { w, h } = SIZE[id];
  let s = opts.scale ?? 1;
  const MAX_AREA = 16e6;                       // keep exports inside mobile canvas limits
  if (w * h * s * s > MAX_AREA) s = Math.sqrt(MAX_AREA / (w * h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s); c.height = Math.round(h * s);
  const ctx = c.getContext('2d');
  ctx.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  DRAW[id](ctx, slots, opts);
  return c;
}

/** Logical size of a layout (for previews). */
export function layoutSize(layoutId) {
  return SIZE[layoutId] ?? SIZE.strip;
}