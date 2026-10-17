/**
 * OldLunar — High-Resolution PNG Export
 *
 * compositeExport() takes:
 *   - photos:      array of PNG Blob objects (from captureFrame)
 *   - options:     filter, adjustments, frame, layout, stickers, caption, dateStamp
 * Returns a PNG Blob at high resolution (at least 1200px wide for strips).
 */

import { FILTER_MAP } from './filters.js';
import { applyAdjustments } from './canvas.js';
import { composeImage, layoutSize } from './photopop/compose.js';

const EXPORT_SCALE = 2; // everything is already at 2× from captureFrame

/* Layouts drawn by the PhotoPop composer (postcard, polaroid). The photo editor's strip and grid are drawn below. */
const COMPOSED_LAYOUTS = ['postcard', 'polaroid'];

/** One photo with the same filter, adjustments and grain the strip uses. Returns a new canvas. */
export function treatPhoto(img, filter, intensity, adjustments) {
  const r = Math.min(1, 1600 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * r)), h = Math.max(1, Math.round(img.height * r));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  filter.apply(ctx, w, h, intensity);
  if (adjustments.brightness !== 100 || adjustments.contrast !== 100 || adjustments.saturation !== 100) {
    applyAdjustments(ctx, w, h, adjustments);
  }
  if (adjustments.grain > 0) {
    const gd = ctx.getImageData(0, 0, w, h), dd = gd.data, amt = adjustments.grain;
    for (let j = 0; j < dd.length; j += 4) {
      const n = (Math.random() - 0.5) * amt;
      dd[j]   = Math.max(0, Math.min(255, dd[j]   + n));
      dd[j+1] = Math.max(0, Math.min(255, dd[j+1] + n));
      dd[j+2] = Math.max(0, Math.min(255, dd[j+2] + n));
    }
    ctx.putImageData(gd, 0, 0);
  }
  return c;
}

/** Postcard / Polaroid export: treated photos go through the PhotoPop composer. */
function composedLayoutExport(images, { filter, intensity, adjustments, layout, showDate, dateFormat, previewWidth }) {
  const slots = [0, 1, 2, 3].map(i => (images[i] ? treatPhoto(images[i], filter, intensity, adjustments) : null));
  const scale = previewWidth > 0 ? previewWidth / layoutSize(layout).w : EXPORT_SCALE;
  const canvas = composeImage(layout, slots, { scale, dateText: showDate ? formatStripDate(dateFormat) : '' });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/** Load a Blob or data URL into an HTMLImageElement */
const imgCache = new Map(); // url -> Promise<HTMLImageElement>
export function loadImg(src) {
  if (typeof src === 'string' && imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = typeof src === 'string' ? null : URL.createObjectURL(src);
    img.onload  = () => { if (blobUrl) URL.revokeObjectURL(blobUrl); resolve(img); };
    img.onerror = (e) => { if (blobUrl) URL.revokeObjectURL(blobUrl); reject(e); };
    img.src = blobUrl ?? src;
  });
  if (typeof src === 'string') {
    imgCache.set(src, p);
    p.catch(() => imgCache.delete(src));
    if (imgCache.size > 16) imgCache.delete(imgCache.keys().next().value); // keep memory bounded
  }
  return p;
}

/** Strip background themes (bg = paper colour, fg = text / frame colour) */
export const STRIP_THEMES = {
  ink:   { bg: '#191516', fg: '#F2EBE7', accent: '#EB6380' },
  cream: { bg: '#F2EBE7', fg: '#191516', accent: '#EB6380' },
  white: { bg: '#FFFFFF', fg: '#191516', accent: '#EB6380' },
  pink:  { bg: '#EB6380', fg: '#191516', accent: '#F2EBE7' },
};
/** Photos in the strip are always 4:3 so the strip comes out long and narrow. */
export const STRIP_AR = 4 / 3;

export const DATE_FORMATS = [
  { id: 'dmy',  label: 'DD.MM.YY' },
  { id: 'mdy',  label: 'MM/DD/YYYY' },
  { id: 'iso',  label: 'YYYY-MM-DD' },
  { id: 'long', label: 'Mon D, YYYY' },
];
export function formatStripDate(fmt, d = new Date()) {
  const p = v => String(v).padStart(2, '0');
  switch (fmt) {
    case 'mdy':  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
    case 'iso':  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    case 'long': return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    default:     return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
  }
}
const FONT_SCALE = { sm: 0.8, md: 1, lg: 1.3 };

/** Frame ids: classic · minimal · film · vintage · polaroid · rounded · none
 *  before(ctx, cells, t, ctxInfo) paints behind the photos, after(...) on top of them. */
const FRAME_STYLES = {
  none: {},
  classic: { after: (ctx, w, h, t, i) => {
    ctx.strokeStyle = t.fg; ctx.lineWidth = 8; ctx.strokeRect(i.ins, i.ins, w - i.ins * 2, h - i.ins * 2);
  } },
  minimal: { after: (ctx, w, h, t, i) => {
    ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = t.fg; ctx.lineWidth = 3;
    ctx.strokeRect(i.ins, i.ins, w - i.ins * 2, h - i.ins * 2); ctx.restore();
  } },
  vintage: { after: (ctx, w, h, t, i) => {
    ctx.strokeStyle = t.fg; ctx.lineWidth = 4; ctx.strokeRect(i.ins, i.ins, w - i.ins * 2, h - i.ins * 2);
    ctx.strokeStyle = t.accent; ctx.lineWidth = 2;
    const o = i.ins + 10; ctx.strokeRect(o, o, w - o * 2, h - o * 2);
  } },
  rounded: { after: (ctx, w, h, t, i) => {
    ctx.strokeStyle = t.fg; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.roundRect(i.ins, i.ins, w - i.ins * 2, h - i.ins * 2, 36); ctx.stroke();
  } },
  polaroid: { before: (ctx, cells, t, i) => {
    const e = Math.max(4, Math.min(16, i.gap / 2 - 4));
    ctx.save();
    ctx.shadowColor = 'rgba(25,21,22,.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; ctx.fillStyle = '#FFFFFF';
    const bottom = Math.max(e, Math.min(e * 2.6, i.gap - e - 4));
    for (const c of cells) { ctx.beginPath(); ctx.roundRect(c.x - e, c.y - e, c.w + e * 2, c.h + e + bottom, 4); ctx.fill(); }
    ctx.restore();
  } },
  film: { after: (ctx, w, h, t, i) => {
    ctx.fillStyle = '#191516';
    ctx.fillRect(0, 0, w, 36); ctx.fillRect(0, h - 36, w, 36);
    ctx.fillStyle = 'rgba(242,235,231,0.25)';
    const holes = Math.floor(w / 52);
    for (let n = 0; n < holes; n++) {
      const x = 26 + n * 52 - 12;
      ctx.beginPath(); ctx.roundRect(x, 6, 24, 22, 6); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x, h - 30, 24, 22, 6); ctx.fill();
    }
    if (i?.wm) return;   // the permanent watermark header already carries the brand + date
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#F2EBE7'; ctx.font = `600 ${Math.round(w * 0.018)}px 'Poppins',sans-serif`;
    ctx.fillText('OldLunar Studio', w / 2, 26);
    ctx.fillStyle = '#EB6380'; ctx.font = `500 ${Math.round(w * 0.013)}px 'Poppins',sans-serif`;
    ctx.fillText(formatStripDate('long'), w / 2, h - 10);
  } },
};

function paintBackground(ctx, w, h, style, theme) {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);
  if (!style || style === 'solid') return;
  ctx.save();
  ctx.fillStyle = theme.fg; ctx.strokeStyle = theme.fg;
  if (style === 'dots') {
    ctx.globalAlpha = 0.14;
    for (let y = 18; y < h; y += 36) for (let x = 18 + ((y / 36) % 2 ? 18 : 0); x < w; x += 36) {
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (style === 'stripes') {
    ctx.globalAlpha = 0.08; ctx.lineWidth = 12;
    for (let x = -h; x < w + h; x += 48) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke(); }
  } else if (style === 'grid') {
    ctx.globalAlpha = 0.09; ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  ctx.restore();
}

/**
 * @param {Blob[]|string[]} photos
 * @param {object} opts
 *   filterId, intensity, adjustments
 *   frameStyle  classic|minimal|film|vintage|polaroid|rounded|none
 *   bgColor     ink|cream|white|pink        bgStyle  solid|dots|stripes|grid
 *   spacing / padding / border / radius     (px at 1× — doubled on export)
 *   caption, text, textPos('top'|'bottom'), fontSize('sm'|'md'|'lg')
 *   showDate, dateFormat, datePos('top'|'bottom')
 *   stickers [{id,x,y,scale,color}], showNumbers
 *   watermark   permanent brand line drawn at the top of the strip, before date/caption
 *   previewWidth  >0 → render a small, fast preview
 * @returns {Promise<Blob>} PNG
 */
export async function compositeExport(photos, opts = {}) {
  const {
    filterId     = 'normal',
    intensity    = 1,
    adjustments  = { brightness:100, contrast:100, saturation:100, grain:0 },
    frameStyle   = 'none',
    layout       = 'strip',
    stickers     = [],
    caption      = '',
    text         = '',
    textPos      = 'bottom',
    fontSize     = 'md',
    showDate     = false,
    dateFormat   = 'dmy',
    datePos      = 'bottom',
    bgColor      = 'ink',
    bgStyle      = 'solid',
    spacing      = 24,
    padding      = 24,
    border       = 0,
    radius       = 0,
    showNumbers  = false,
    previewWidth = 0,
    refs         = [],      // PairSnap: pose reference images. When given, every row is [camera photo | pose]
    watermark    = '',      // permanent brand line, always drawn above date/caption on the strip (not part of the user's text options)
  } = opts;

  const filter = FILTER_MAP[filterId] ?? FILTER_MAP['normal'];
  const theme  = STRIP_THEMES[bgColor] ?? STRIP_THEMES.ink;
  const frame  = FRAME_STYLES[frameStyle] ?? FRAME_STYLES.none;

  try { await Promise.all([document.fonts?.load("700 40px Poppins"), document.fonts?.load("600 40px Poppins"), document.fonts?.load("500 40px Poppins")]); } catch { /* fonts are best-effort */ }

  const images = await Promise.all(photos.map(loadImg));
  const refImgs = refs.length ? await Promise.all(refs.map(loadImg)) : [];
  const paired = refImgs.length > 0;

  if (!paired && COMPOSED_LAYOUTS.includes(layout)) {
    return composedLayoutExport(images, { filter, intensity, adjustments, layout, showDate, dateFormat, previewWidth });
  }
  const count  = images.length;
  /* paired → [photo, pose, photo, pose …] so the camera shot is the left cell and the pose the right cell of each row */
  const items = paired
    ? images.flatMap((img, n) => (refImgs[n] ? [{ img, n }, { img: refImgs[n], ref: true }] : [{ img, n }]))
    : images.map((img, n) => ({ img, n }));

  /* All layout maths happens in "logical" full-res units; `k` scales the
     real canvas down for previews so frames / stickers / text look identical. */
  const PAD = Math.round(padding * EXPORT_SCALE);
  const GAP = Math.round(spacing * EXPORT_SCALE);
  const fs  = FONT_SCALE[fontSize] ?? 1;

  /* Footer hierarchy, top to bottom:  BRAND  ·  caption  ·  date.
     The brand line (permanent watermark, or the Name caption), the caption text and the date each follow the
     Top / Bottom position settings: Text position moves the brand + caption group, Date position moves the date. */
  const kinds = [];
  if (watermark) kinds.push({ kind: 'watermark', pos: textPos });
  if (caption)   kinds.push({ kind: 'caption',   pos: textPos });
  if (text)      kinds.push({ kind: 'text',      pos: textPos });
  if (showDate)  kinds.push({ kind: 'date',      pos: datePos });
  const topKinds = kinds.filter(k => k.pos === 'top');
  const botKinds = kinds.filter(k => k.pos !== 'top');
  /* Footer lines are stacked tightly: each line is only as tall as its own text, with one small, equal gap between lines.
     (Previously the block height was split evenly between rows, which left a large empty gap between BRAND, caption and date.) */
  const UNIT     = Math.round(46 * fs * EXPORT_SCALE);                      // base text unit
  const LINE_PAD = Math.round(UNIT * 0.06);                                 // gap between footer lines
  const EDGE_PAD = Math.round(10 * EXPORT_SCALE);                           // space above / below the footer block
  const sizeOf   = kind => Math.round(UNIT * ({ watermark: 0.46, caption: 0.5, text: 0.42, date: 0.36 }[kind] ?? 0.36));
  const lineH    = kind => Math.round(sizeOf(kind) * 1.15);
  const blockH   = list => (list.length ? EDGE_PAD * 2 + list.reduce((n, it) => n + lineH(it.kind), 0) + LINE_PAD * (list.length - 1) : 0);
  const TOP_H = blockH(topKinds), BOT_H = blockH(botKinds);

  const isStrip = paired || layout === 'strip' || count === 1;
  const cols = paired ? 2 : isStrip ? 1 : 2;
  const rows = paired ? count : isStrip ? count : (layout === 'grid2x3' ? 3 : Math.ceil(count / 2));
  const ar   = isStrip ? STRIP_AR : ((images[0]?.width && images[0]?.height) ? images[0].width / images[0].height : 16 / 9);

  const canvasW = isStrip ? 1200 : Math.max(1200, (images[0]?.width ?? 640) * 2 + PAD * 3);
  const cellW   = Math.round((canvasW - PAD * 2 - GAP * (cols - 1)) / cols);
  const cellH   = Math.round(cellW / ar);
  const photosH = PAD * 2 + GAP * (rows - 1) + cellH * rows;
  const canvasH = photosH + TOP_H + BOT_H;

  const cells = Array.from({ length: Math.min(items.length, cols * rows) }, (_, i) => ({
    x: PAD + (i % cols) * (cellW + GAP), y: PAD + Math.floor(i / cols) * (cellH + GAP), w: cellW, h: cellH,
  }));

  const k = previewWidth > 0 ? Math.min(1, previewWidth / canvasW) : 1;
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(canvasW * k);
  canvas.height = Math.round(canvasH * k);
  const ctx = canvas.getContext('2d');
  ctx.scale(k, k);

  paintBackground(ctx, canvasW, canvasH, bgStyle, theme);

  const info = { ins: Math.max(4, Math.min(14, PAD / 2 - 4)), gap: GAP, pad: PAD, wm: !!watermark };
  const cornerR = Math.max(radius * EXPORT_SCALE, frameStyle === 'rounded' ? (paired ? 8 : 28) : 0);

  /* ── photos, frame, stickers: drawn in the "photo area" (shifted down by the top text block) ── */
  ctx.save();
  ctx.translate(0, TOP_H);
  frame.before?.(ctx, cells, theme, info);

  for (let i = 0; i < items.length && i < cells.length; i++) {
    const { img, ref } = items[i];
    const { x, y, w, h } = cells[i];

    /* Snap every cell to whole device pixels from its shared edges, so neighbouring photos meet exactly
       (no hairline seams or 1px gaps at any preview scale). */
    const dx = Math.round(x * k), dy = Math.round((y + TOP_H) * k);
    const cw = Math.max(1, Math.round((x + w) * k) - dx), ch = Math.max(1, Math.round((y + TOP_H + h) * k) - dy);
    const offCell = document.createElement('canvas');
    offCell.width = cw; offCell.height = ch;
    const oc = offCell.getContext('2d', { willReadFrequently: true });

    // Cover-fit the image in the cell (never stretched)
    const imgAr = img.width / img.height, cellAr = w / h;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAr > cellAr) { sw = img.height * cellAr; sx = (img.width - sw) / 2; }
    else                { sh = img.width / cellAr;  sy = (img.height - sh) / 2; }

    oc.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);

    /* pose references stay exactly as the original picture — filters/adjustments only touch the camera shots */
    if (!ref) filter.apply(oc, cw, ch, intensity);

    if (!ref && (adjustments.brightness !== 100 || adjustments.contrast !== 100 || adjustments.saturation !== 100)) {
      applyAdjustments(oc, cw, ch, adjustments);
    }
    if (!ref && adjustments.grain > 0) {
      const gd = oc.getImageData(0, 0, cw, ch), dd = gd.data, amt = adjustments.grain;
      for (let j = 0; j < dd.length; j += 4) {
        const n = (Math.random() - 0.5) * amt;
        dd[j]   = Math.max(0, Math.min(255, dd[j]   + n));
        dd[j+1] = Math.max(0, Math.min(255, dd[j+1] + n));
        dd[j+2] = Math.max(0, Math.min(255, dd[j+2] + n));
      }
      oc.putImageData(gd, 0, 0);
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);            // draw in device pixels
    if (cornerR > 0) { ctx.beginPath(); ctx.roundRect(dx, dy, cw, ch, Math.min(cornerR * k, ch / 2, cw / 2)); ctx.clip(); }
    ctx.drawImage(offCell, dx, dy);
    ctx.restore();

    if (showNumbers && !ref) {
      const r = 22, bx = x + 16 + r, by = y + h - 16 - r;
      ctx.save();
      ctx.fillStyle = 'rgba(25,21,22,.78)';
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F2EBE7'; ctx.font = "600 24px 'Poppins',sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(items[i].n + 1), bx, by + 1);
      ctx.restore();
    }
  }

  frame.after?.(ctx, canvasW, photosH, theme, info);
  for (const stk of stickers) drawSticker(ctx, stk, canvasW, photosH);
  ctx.restore();

  /* ── outer border ── */
  if (border > 0) {
    const b = border * EXPORT_SCALE;
    ctx.save(); ctx.strokeStyle = theme.fg; ctx.lineWidth = b;
    ctx.strokeRect(b / 2, b / 2, canvasW - b, canvasH - b); ctx.restore();
  }

  /* ── text blocks (name / caption / date), above and/or below the photos ── */
  /* Shrink a line until it fits inside the strip's printable width (long captions never clip). */
  const fitFont = (txt, weight, size, maxW) => {
    ctx.font = `${weight} ${size}px 'Poppins',sans-serif`;
    const w = ctx.measureText(txt).width;
    if (w > maxW) ctx.font = `${weight} ${Math.max(10, Math.floor(size * maxW / w))}px 'Poppins',sans-serif`;
  };
  const drawBlock = (list, y0) => {
    if (!list.length) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const maxW = canvasW - PAD * 2;
    let y = y0 + EDGE_PAD;
    list.forEach(it => {
      const lh = lineH(it.kind), size = sizeOf(it.kind), ry = y + lh / 2;
      if (it.kind === 'watermark') {
        ctx.fillStyle = theme.fg;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.06)}px`;
        fitFont(watermark, 800, size, maxW);
        ctx.fillText(watermark, canvasW / 2, ry);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      } else if (it.kind === 'caption') {
        ctx.fillStyle = theme.fg;
        fitFont(caption.slice(0, 24), 700, size, maxW);
        ctx.fillText(caption.slice(0, 24), canvasW / 2, ry);
      } else if (it.kind === 'text') {
        ctx.fillStyle = theme.fg; ctx.globalAlpha = 0.85;
        fitFont(text.slice(0, 32), 600, size, maxW);
        ctx.fillText(text.slice(0, 32), canvasW / 2, ry);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = theme.accent;
        const d = formatStripDate(dateFormat);
        fitFont(d, 600, size, maxW);
        ctx.fillText(d, canvasW / 2, ry);
      }
      y += lh + LINE_PAD;
    });
    ctx.restore();
  };
  drawBlock(topKinds, 0);
  drawBlock(botKinds, TOP_H + photosH);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/** Draw a sticker on the canvas. sticker: {id, x, y, scale, color} */
function drawSticker(ctx, stk, cw, ch) {
  // x,y are 0–1 relative positions
  const px = stk.x * cw;
  const py = stk.y * ch;
  const sz = (stk.scale ?? 1) * 96;
  ctx.save();
  ctx.translate(px, py);
  ctx.font = `${sz}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // FA glyphs can't render on canvas; use simple SVG paths instead
  ctx.fillStyle = (stk.color === 'pink' || stk.color === 'purple') ? '#EB6380' : stk.color === 'dark' ? '#191516' : '#F2EBE7';
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8;
  switch(stk.id) {
    case 'star':    drawStar4(ctx, sz); break;
    case 'heart':   drawHeart(ctx, sz); break;
    case 'sparkle': drawSparkle(ctx, sz); break;
    case 'crown':   drawCrown(ctx, sz); break;
    case 'moon':    drawMoon(ctx, sz); break;
    case 'camera':  drawCameraIcon(ctx, sz); break;
    default: break;
  }
  ctx.restore();
}

function drawStar4(ctx, sz) {
  const r=sz/2, r2=r*0.4;
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4-Math.PI/2;
    const rr=i%2===0?r:r2;
    i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
  }
  ctx.closePath(); ctx.fill();
}
function drawHeart(ctx, sz) {
  const s=sz/40;
  ctx.beginPath();
  ctx.moveTo(0,-sz*0.1);
  ctx.bezierCurveTo(s*10,-sz*0.35,s*20,sz*0.05,0,sz*0.38);
  ctx.bezierCurveTo(-s*20,sz*0.05,-s*10,-sz*0.35,0,-sz*0.1);
  ctx.fill();
}
function drawSparkle(ctx, sz) {
  const r=sz/2;
  ctx.beginPath();
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    const rr=i%3===0?r:r*0.3;
    i===0?ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
  }
  ctx.closePath(); ctx.fill();
}
function drawCrown(ctx, sz) {
  const w=sz, h=sz*0.6, y=-h/2;
  ctx.beginPath();
  ctx.moveTo(-w/2,y+h); ctx.lineTo(-w/2,y+h*0.3); ctx.lineTo(-w/4,y+h*0.7);
  ctx.lineTo(0,y); ctx.lineTo(w/4,y+h*0.7); ctx.lineTo(w/2,y+h*0.3);
  ctx.lineTo(w/2,y+h); ctx.closePath(); ctx.fill();
}
function drawMoon(ctx, sz) {
  // crescent cut out on a scratch canvas so nothing dark is painted over the photo
  const r = sz * 0.42, d = Math.ceil(sz * 1.2);
  const c = document.createElement('canvas'); c.width = d; c.height = d;
  const g = c.getContext('2d');
  g.fillStyle = ctx.fillStyle;
  g.beginPath(); g.arc(d/2, d/2, r, 0, Math.PI*2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(d/2 + r*0.38, d/2 - r*0.1, r*0.76, 0, Math.PI*2); g.fill();
  ctx.drawImage(c, -d/2, -d/2);
}
function drawCameraIcon(ctx, sz) {
  const w=sz*0.85, h=sz*0.6, rx=sz*0.08;
  ctx.beginPath(); ctx.roundRect(-w/2,-h/2,w,h,rx); ctx.fill();
  ctx.fillStyle='#000';
  ctx.beginPath(); ctx.arc(0,sz*0.04,sz*0.18,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(sz*0.05,-sz*0.02,sz*0.08,0,Math.PI*2); ctx.fill();
}