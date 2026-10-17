/**
 * OldLunar — strip design helpers
 *
 * Converts the landing-page builder's choices into the photo editor's vocabulary.
 * (Share links were removed: nothing here builds, parses or copies a link.)
 */
import { FILTERS } from './filters.js';

const FRAME_IDS    = ['classic', 'minimal', 'film', 'vintage', 'polaroid', 'rounded', 'none'];
const BG_IDS       = ['cream', 'white', 'ink', 'pink'];
const BG_STYLE_IDS = ['solid', 'dots', 'stripes', 'grid'];
const STICKER_IDS  = ['star', 'heart', 'sparkle', 'crown', 'moon', 'camera'];
const FILTER_IDS   = FILTERS.map(f => f.id);

const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

export function sanitizeDesign(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const intensity = Number.isFinite(r.intensity) ? Math.min(100, Math.max(0, Math.round(r.intensity))) : 100;
  return {
    frameStyle:  pick(r.frameStyle, FRAME_IDS, 'classic'),
    bgColor:     pick(r.bgColor, BG_IDS, 'cream'),
    bgStyle:     pick(r.bgStyle, BG_STYLE_IDS, 'solid'),
    caption:     typeof r.caption === 'string' ? r.caption.slice(0, 24) : 'OLDLUNAR',
    showCaption: r.showCaption !== false,
    showDate:    r.showDate !== false,
    stickers:    Array.isArray(r.stickers) ? r.stickers.filter(s => STICKER_IDS.includes(s)).slice(0, 6) : [],
    filter:      pick(r.filter, FILTER_IDS, 'normal'),
    intensity,
  };
}

/* ── Landing builder ⇄ editor vocabulary ── */
const B_TO_E_FRAME = { none: 'none', thin: 'minimal', thick: 'classic', rounded: 'rounded', film: 'film' };
const B_TO_E_COLOR = { cream: 'cream', clean: 'white', black: 'ink', film: 'cream', pink: 'pink' };

export function builderToDesign({ frame, color, caption, showDate }) {
  return sanitizeDesign({
    frameStyle: B_TO_E_FRAME[frame],
    bgColor: B_TO_E_COLOR[color],
    caption,
    showCaption: !!caption,
    showDate,
  });
}

/** Patch for the photo editor state (App.jsx editorState). */
export function designToEditor(d) {
  return {
    frameStyle: d.frameStyle, bgColor: d.bgColor, bgStyle: d.bgStyle,
    caption: d.caption, showCaption: d.showCaption && !!d.caption,
    showDate: d.showDate, stickers: d.stickers, stylePreset: 'custom',
  };
}
