/**
 * PhotoEditor — Step 4 "Final Output".
 * Left: live strip preview. Right: Style (filter · style · frame) and Customize (text · date · layout · background · decorations) + actions.
 * Every control feeds the same options object that is used for the preview AND for the downloaded PNG.
 */
import { useState, useRef, useEffect, useCallback, useId } from 'react';
import {
  Calendar, Camera, Check, ChevronDown, Crown, Download, Frame, Heart, LayoutGrid, Moon, Palette, Printer, QrCode, Share2, Sparkles, Star, Trash2, Type,
} from '../icons.jsx';
import { FILTERS, DEFAULT_INTENSITY } from '../utils/filters.js';
import { compositeExport, loadImg, STRIP_THEMES, DATE_FORMATS } from '../utils/export.js';
import { downloadBlob, pngFilename } from '../utils/canvas.js';
import { qrDataUrl } from '../utils/qr.js';   // Share panel only
import { toShareJpeg, uploadStrip } from '../utils/shareLink.js';
import { playClick, playDownload } from '../utils/sounds.js';
import Dropdown from './Dropdown.jsx';
import './camera.css';
import './finalOutput.css';

const NO_REFS = [];   // stable default so the preview effect doesn't re-fire every render

/* ── Options ── */
export const FRAMES = [
  { id: 'classic', label: 'Classic' }, { id: 'minimal', label: 'Minimal' }, { id: 'film', label: 'Film' },
  { id: 'vintage', label: 'Vintage' }, { id: 'polaroid', label: 'Polaroid' }, { id: 'rounded', label: 'Rounded' },
  { id: 'none', label: 'No Frame' },
];
const BGS = [
  { id: 'cream', label: 'Cream' }, { id: 'white', label: 'White' }, { id: 'ink', label: 'Dark' }, { id: 'pink', label: 'Pink' },
];
const BG_STYLES = [
  { id: 'solid', label: 'Plain' }, { id: 'dots', label: 'Dots' }, { id: 'stripes', label: 'Stripes' }, { id: 'grid', label: 'Grid' },
];
const BASE_LAYOUT = { spacing: 0, padding: 24, border: 0, radius: 0, stickers: [] };
export const STYLE_PRESETS = [
  { id: 'classic',  label: 'Classic',  patch: { bgColor: 'cream', frameStyle: 'classic',  bgStyle: 'solid' } },
  { id: 'minimal',  label: 'Minimal',  patch: { bgColor: 'white', frameStyle: 'minimal',  bgStyle: 'solid' } },
  { id: 'romantic', label: 'Romantic', patch: { bgColor: 'pink',  frameStyle: 'rounded',  bgStyle: 'dots', radius: 12, stickers: ['heart', 'sparkle'] } },
  { id: 'film',     label: 'Film',     patch: { bgColor: 'ink',   frameStyle: 'film',     bgStyle: 'solid' } },
  { id: 'vintage',  label: 'Vintage',  patch: { bgColor: 'cream', frameStyle: 'vintage',  bgStyle: 'stripes' } },
  { id: 'clean',    label: 'Clean',    patch: { bgColor: 'white', frameStyle: 'none',     bgStyle: 'solid', padding: 16 } },
  { id: 'dark',     label: 'Dark',     patch: { bgColor: 'ink',   frameStyle: 'minimal',  bgStyle: 'grid' } },
  { id: 'pink',     label: 'Pink',     patch: { bgColor: 'pink',  frameStyle: 'classic',  bgStyle: 'solid' } },
];
export const LAYOUT_PRESETS = [
  { id: 'classic', label: 'Classic Vertical', patch: { layout: 'strip', frameStyle: 'classic', bgColor: 'cream', bgStyle: 'solid' } },
  { id: 'film',    label: 'Retro Film',       patch: { layout: 'strip', frameStyle: 'film',    bgColor: 'ink',   bgStyle: 'solid' } },
  { id: 'grid',    label: 'Four-Frame Grid',  patch: { layout: 'grid',  frameStyle: 'classic', bgColor: 'cream', bgStyle: 'solid' } },
  { id: 'postcard', label: 'Postcard',        patch: { layout: 'postcard', frameStyle: 'none',    bgColor: 'cream', bgStyle: 'solid' } },
  { id: 'polaroid', label: 'Polaroid Prints', patch: { layout: 'polaroid', frameStyle: 'none',    bgColor: 'ink',   bgStyle: 'solid' } },
  { id: 'minimal', label: 'Minimal Cream',    patch: { layout: 'strip', frameStyle: 'minimal', bgColor: 'cream', bgStyle: 'solid' } },
];
/* layouts that need four photos side by side are not offered for paired (pose) strips */
const PAIRED_EXCLUDED = ['grid', 'postcard', 'polaroid'];
/* Layouts you can try on your own photos. Built from LAYOUT_PRESETS, so applying one is the same as the preset dropdown. */
const TRY_LAYOUTS = ['classic', 'grid', 'postcard', 'polaroid'].map(id => LAYOUT_PRESETS.find(p => p.id === id));
const COMPOSED_NOTE_LAYOUTS = ['postcard', 'polaroid'];
const STICKERS = [
  { id: 'star', label: 'Star', Icon: Star }, { id: 'heart', label: 'Heart', Icon: Heart }, { id: 'sparkle', label: 'Sparkle', Icon: Sparkles },
  { id: 'crown', label: 'Crown', Icon: Crown }, { id: 'moon', label: 'Moon', Icon: Moon }, { id: 'camera', label: 'Camera', Icon: Camera },
];
const STICKER_SPOTS = [[.10, .025], [.90, .275], [.10, .525], [.90, .775], [.88, .025], [.12, .975]];
const STICKER_COLORS = [{ id: 'pink', label: 'Pink', c: '#EB6380' }, { id: 'cream', label: 'Cream', c: '#F2EBE7' }, { id: 'dark', label: 'Dark', c: '#191516' }];
const ADJUSTS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150 },
  { key: 'contrast',   label: 'Contrast',   min: 50, max: 150 },
  { key: 'saturation', label: 'Saturation', min: 0,  max: 200 },
  { key: 'grain',      label: 'Grain',      min: 0,  max: 60 },
];
/* Layout sliders are shown in % of the strip width (600 px at 1×). The editor still stores px, so presets and export are unchanged. */
const STRIP_W = 600;
const toPct = px => Math.round(((px ?? 0) / STRIP_W) * 1000) / 10;
const toPx  = pct => Math.round((pct / 100) * STRIP_W);
const POS = [{ id: 'top', label: 'Top' }, { id: 'bottom', label: 'Bottom' }];
const SIZES = [{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }];
const dateLabel = id => DATE_FORMATS.find(f => f.id === id)?.label ?? '';

/* ── Small building blocks ── */
function Switch({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`pb-sw ${on ? 'is-on' : ''}`} onClick={onChange} />;
}

function Slider({ label, value, min, max, onChange, suffix = '', step = 1 }) {
  return (
    <div className="fo-slider">
      <label>{label}<b>{value}{suffix}</b></label>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
             style={{ '--fill': `${((value - min) / (max - min)) * 100}%` }}
             onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="fo-seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="fo-seg-b" onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return <div className="fo-field"><span className="pb-label">{label}</span>{children}</div>;
}

/** One collapsible row. Collapsed content is `visibility:hidden` so it can't be tabbed into. */
function Section({ id, icon, title, value, open, onToggle, children }) {
  return (
    <div className={`fo-acc ${open ? 'is-open' : ''}`}>
      <button type="button" className="fo-acc-h" id={`fo-h-${id}`} aria-expanded={open} aria-controls={`fo-p-${id}`} onClick={onToggle}>
        <span className="fo-ic">{icon}</span>
        <span className="fo-acc-t">{title}</span>
        {value && <span className="fo-acc-v">{value}</span>}
        <ChevronDown className="fo-chev" size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <div className="fo-acc-b" id={`fo-p-${id}`} role="region" aria-labelledby={`fo-h-${id}`}>
        <div className="fo-acc-in"><div className="fo-acc-pad">{children}</div></div>
      </div>
    </div>
  );
}

/** Filter thumbnails are rendered with the real filter code on a tiny canvas, so they match the result. */
function useFilterThumbs(url) {
  const [thumbs, setThumbs] = useState({});
  useEffect(() => {
    if (!url) return;
    let dead = false;
    (async () => {
      try {
        const img = await loadImg(url);
        const W = 168, H = 126;
        const base = document.createElement('canvas'); base.width = W; base.height = H;
        const bc = base.getContext('2d');
        const ar = img.width / img.height, car = W / H;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (ar > car) { sw = img.height * car; sx = (img.width - sw) / 2; } else { sh = img.width / car; sy = (img.height - sh) / 2; }
        bc.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        const out = {};
        for (const f of FILTERS) {
          if (dead) return;
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const cx = c.getContext('2d', { willReadFrequently: true });
          cx.drawImage(base, 0, 0);
          f.apply(cx, W, H, 1);
          out[f.id] = c.toDataURL('image/jpeg', 0.82);
          await new Promise(r => setTimeout(r, 0));
        }
        if (!dead) setThumbs(out);
      } catch { /* thumbnails are optional */ }
    })();
    return () => { dead = true; };
  }, [url]);
  return thumbs;
}

/* ── Unified look panel: Styles · Frames · Backgrounds ── */
const LOOK_TABS = [
  { id: 'styles',      label: 'Styles',      Icon: Sparkles },
  { id: 'frames',      label: 'Frames',      Icon: Frame },
  { id: 'layouts',     label: 'Layouts',     Icon: LayoutGrid },
  { id: 'backgrounds', label: 'Backgrounds', Icon: Palette },
];
/* the original look every category can return to */
const ORIGINAL_LOOK = { frameStyle: 'classic', bgColor: 'cream', bgStyle: 'solid', stylePreset: 'classic' };

/**
 * Thumbnails for frames / backgrounds / quick looks, drawn by the SAME compositeExport() as the preview and the download,
 * on the first two photos with the user's current filter, spacing and other choices. So what you see is what you get.
 * Thumbs arrive one by one; a changed look re-renders only the active tab and keeps showing the old thumb until the new one is ready.
 */
function useStripThumbs(photoUrls, specs, makeOpts, depKey) {
  const [map, setMap] = useState({});
  const store = useRef({});   // key -> object URL
  useEffect(() => {
    if (!photoUrls.length || !specs.length) return;
    let dead = false;
    const t = setTimeout(async () => {
      for (const sp of specs) {
        if (dead) return;
        const sample = photoUrls.slice(0, sp.count ?? 2);   // layouts need all four photos; looks use two
        try {
          const blob = await compositeExport(sample, {
            ...makeOpts(sp.state), previewWidth: 200,
            caption: '', text: '', showDate: false, watermark: '', showNumbers: false,   // too small to read, and they hide the frame
          });
          if (dead) return;
          if (blob) {
            const old = store.current[sp.key];
            store.current[sp.key] = URL.createObjectURL(blob);
            setMap({ ...store.current });
            if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
          }
        } catch { /* a missing thumbnail falls back to a colour swatch */ }
        await new Promise(r => setTimeout(r, 0));   // let the UI breathe between thumbs
      }
    }, 120);
    return () => { dead = true; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrls, depKey]);
  useEffect(() => () => { Object.values(store.current).forEach(u => URL.revokeObjectURL(u)); store.current = {}; }, []);
  return map;
}

/** One selectable thumbnail card (radio). `fallback` is a CSS background used until / unless the image is available. */
function Thumb({ label, src, selected, onSelect, fallback, tag }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [src]);
  return (
    <button type="button" role="radio" aria-checked={selected} className="fo-th" onClick={onSelect}>
      <span className="fo-th-i" style={!src || bad ? { background: fallback } : undefined}>
        {src && !bad && <img src={src} alt="" draggable={false} onError={() => setBad(true)} />}
        {selected && <span className="fo-th-ck" aria-hidden="true"><Check size={12} /></span>}
      </span>
      <span className="fo-th-l">{label}</span>
      {tag && <span className="fo-th-tag">{tag}</span>}
    </button>
  );
}

export default function PhotoEditor({
  photoUrls, filterId, onFilterChange, intensity, onIntensityChange,
  editorState: es, onStateChange, onResetEditor, onRetake, onSave, soundEnabled,
  fileName = null, showLayoutPresets = false,
  refs = NO_REFS,         // PairSnap: pose images → each strip row becomes [camera photo | pose]
  lockedWatermark = '',   // when set: drawn on every preview/download/share/print and cannot be edited or switched off
}) {
  const uid = useId();
  const { adjustments } = es;

  const [open, setOpen] = useState(null);
  const [tab, setTab] = useState('styles');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rendering, setRendering] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: '', err: false });
  const lastUrl = useRef(null);
  const savedRef = useRef(false);
  const msgTimer = useRef(0);
  const thumbs = useFilterThumbs(photoUrls[0]);

  /* single source of truth: used by the live preview AND the downloaded file */
  const makeOpts = useCallback((es) => ({
    filterId, intensity: intensity / 100,
    adjustments, frameStyle: es.frameStyle, layout: es.layout || 'strip', bgColor: es.bgColor, bgStyle: es.bgStyle,
    spacing: es.spacing, padding: es.padding, border: es.border, radius: es.radius,
    caption: !lockedWatermark && es.showCaption ? es.caption : '', watermark: lockedWatermark || '', refs, text: es.showText ? es.text : '',
    textPos: es.textPos, fontSize: es.fontSize,
    showDate: es.showDate, dateFormat: es.dateFormat, datePos: es.datePos,
    stickers: STICKERS.filter(s => es.stickers.includes(s.id)).map((s, i) => ({
      id: s.id, x: STICKER_SPOTS[i % STICKER_SPOTS.length][0], y: STICKER_SPOTS[i % STICKER_SPOTS.length][1],
      scale: es.stickerSize, color: es.stickerColor,
    })),
    showNumbers: es.showNumbers,
  }), [filterId, intensity, adjustments, lockedWatermark, refs]);
  const buildOpts = useCallback(() => makeOpts(es), [makeOpts, es]);

  /* Live preview: small render, coalesced to one per frame, stale renders are dropped */
  useEffect(() => {
    if (!photoUrls.length) return;
    let cancelled = false;
    setRendering(true);
    const raf = requestAnimationFrame(async () => {
      try {
        const blob = await compositeExport(photoUrls, { ...buildOpts(), previewWidth: 720 });
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setPreviewUrl(url);
      } catch (e) {
        console.error('Preview failed', e);
        if (!cancelled) flash('Preview could not be updated. Try another setting.', true);
      } finally { if (!cancelled) setRendering(false); }
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrls, buildOpts]);
  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); clearTimeout(msgTimer.current); }, []);

  function flash(t, err = false) {
    clearTimeout(msgTimer.current);
    setMsg({ text: t, err });
    msgTimer.current = setTimeout(() => setMsg({ text: '', err: false }), err ? 9000 : 3200);
  }
  const makeFinal = () => compositeExport(photoUrls, buildOpts());   // full resolution, every edit included
  const afterExport = blob => { if (!savedRef.current) { savedRef.current = true; onSave?.(blob); } };
  const run = async (fn, failText) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { console.error(e); flash(failText, true); } finally { setBusy(false); }
  };

  const handleDownload = () => run(async () => {
    const blob = await makeFinal();
    if (!blob) throw new Error('empty');
    playDownload(soundEnabled);
    downloadBlob(blob, fileName ? fileName() : pngFilename());
    afterExport(blob);
    flash('Saved! Check your downloads.');
  }, 'Download failed. Please try again.');

  /* Share → the finished strip image through the device share sheet (falls back to a download). No links. */
  const handleShare = () => run(async () => {
    playClick(soundEnabled);
    const blob = await makeFinal();
    if (!blob) throw new Error('empty');
    const name = fileName ? fileName() : 'oldlunar studio-photostrip.png';
    const file = new File([blob], name, { type: 'image/png' });
    afterExport(blob);
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'My OldLunar Studio photo strip' }); flash('Shared!'); return; }
      catch (e) { if (e.name === 'AbortError') return; throw e; }
    }
    downloadBlob(blob, name);
    flash('Sharing isn’t supported here, so your strip was downloaded.');
  }, 'Couldn’t share the image. Try downloading it instead.');

  const handlePrint = () => {
    const w = window.open('', '_blank'); // open now so pop-up blockers allow it
    if (!w) { flash('Allow pop-ups to print your strip.', true); return; }
    run(async () => {
      const blob = await makeFinal();
      afterExport(blob);
      const url = URL.createObjectURL(blob);
      w.document.write(`<!doctype html><title>OldLunar</title><style>@page{margin:8mm}body{margin:0;display:grid;place-items:center}img{max-width:100%;max-height:100vh}</style><img src="${url}" onload="print()">`);
      w.document.close();
    }, 'Printing failed. Try downloading instead.');
  };

  /* Download QR: the finished strip is uploaded once, and the code links to that file.
     Scanning it on a phone downloads the strip directly (Android and iPhone). */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl]   = useState('');   // download link for this strip
  const [expiresAt, setExpiresAt] = useState('');   // when that link stops working (ISO time)
  const [qrSrc, setQrSrc]         = useState('');   // QR code (PNG) for shareUrl

  /* A code made for an earlier design would download the old strip, so it is cleared when any setting changes. */
  useEffect(() => { setQrSrc(''); setShareUrl(''); setExpiresAt(''); }, [buildOpts]);

  const toggleShare = () => { playClick(soundEnabled); setShareOpen(o => !o); };

  const makeDownloadQr = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const png = await makeFinal();
      if (!png) throw new Error('The strip could not be prepared.');
      afterExport(png);
      const { url, expiresAt: until } = await uploadStrip(await toShareJpeg(png));
      setQrSrc(await qrDataUrl(url, 640));
      setShareUrl(url);
      setExpiresAt(until);
      flash('Scan the code with your phone to download your strip.');
    } catch (err) {
      console.error('Download QR failed:', err);
      flash(`Couldn’t create the download QR code. ${err.message || 'Please try again.'}`, true);
    } finally {
      setBusy(false);
    }
  };

  const qrFile = async () => new File([await (await fetch(qrSrc)).blob()], 'oldlunar-download-qr.png', { type: 'image/png' });
  const handleDownloadQr = async () => {
    playDownload(soundEnabled);
    downloadBlob(await qrFile(), 'oldlunar-download-qr.png');
    flash('QR code saved.');
  };
  const handleShareQr = async () => {
    playClick(soundEnabled);
    const file = await qrFile();
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'My OldLunar Studio photo strip', text: 'Scan to download my photo strip', url: shareUrl }); flash('Shared!'); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    downloadBlob(file, 'oldlunar-download-qr.png');
    flash('Sharing isn’t supported here, so the QR code was downloaded.');
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); flash('Link copied.'); }
    catch { flash('Couldn’t copy the link. Select it and copy it instead.', true); }
  };

  const handleDelete = () => { if (window.confirm('Discard these photos and retake?')) { playClick(soundEnabled); onRetake(); } };
  const click = fn => (...a) => { playClick(soundEnabled); fn(...a); };
  const toggle = id => click(() => setOpen(o => (o === id ? null : id)));

  /* edits that change the look flip the Style dropdown to "Custom" */
  const edit = patch => onStateChange({ ...patch, stylePreset: 'custom' });
  const applyPreset = id => {
    const p = STYLE_PRESETS.find(x => x.id === id);
    if (p) { playClick(soundEnabled); onStateChange({ ...BASE_LAYOUT, ...p.patch, stylePreset: id }); }
  };
  const toggleSticker = id => click(() => edit({ stickers: es.stickers.includes(id) ? es.stickers.filter(s => s !== id) : [...es.stickers, id] }))();

  /* ── Unified look panel: thumbnails of the ACTIVE tab, rendered with the current look ── */
  const presetState = p => ({ ...es, ...BASE_LAYOUT, ...p.patch });
  const lookSpecs = tab === 'layouts'     ? TRY_LAYOUTS.map(p => ({ key: `layout:${p.id}`, state: { ...es, ...p.patch }, count: 4 }))
                  : tab === 'frames'      ? FRAMES.map(f => ({ key: `frame:${f.id}`, state: { ...es, frameStyle: f.id } }))
                  : tab === 'backgrounds' ? [...BGS.map(b => ({ key: `bgc:${b.id}`, state: { ...es, bgColor: b.id } })),
                                             ...BG_STYLES.map(b => ({ key: `bgs:${b.id}`, state: { ...es, bgStyle: b.id } }))]
                  : STYLE_PRESETS.map(p => ({ key: `look:${p.id}`, state: presetState(p) }));
  const lookKey = JSON.stringify([tab, filterId, intensity, adjustments, es.frameStyle, es.bgColor, es.bgStyle, es.spacing, es.padding, es.border, es.radius, es.layout, es.stickers, es.stickerSize, es.stickerColor, refs.length]);
  const lookThumbs = useStripThumbs(photoUrls, lookSpecs, makeOpts, lookKey);
  const pickFrame = id => { playClick(soundEnabled); edit({ frameStyle: id }); };
  const pickLayout = p => { playClick(soundEnabled); onStateChange({ ...p.patch, stylePreset: 'custom' }); };
  const layoutIs = p => (es.layout || 'strip') === p.patch.layout;
  const pickBgColor = id => { playClick(soundEnabled); edit({ bgColor: id }); };
  const pickBgStyle = id => { playClick(soundEnabled); edit({ bgStyle: id }); };
  const resetLook = () => { playClick(soundEnabled); onFilterChange('normal'); onIntensityChange(DEFAULT_INTENSITY); onStateChange(ORIGINAL_LOOK); };
  const isOriginalLook = filterId === 'normal' && es.frameStyle === 'classic' && es.bgColor === 'cream' && es.bgStyle === 'solid';
  const lookTabs = refs.length ? LOOK_TABS.filter(t => t.id !== 'layouts') : LOOK_TABS;
  const onTabKey = e => {
    const i = lookTabs.findIndex(t => t.id === tab);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? lookTabs.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const t = lookTabs[(n + lookTabs.length) % lookTabs.length];
    setTab(t.id);
    requestAnimationFrame(() => document.getElementById(`${uid}-tab-${t.id}`)?.focus());
  };
  const swatchBg = id => STRIP_THEMES[id]?.bg ?? '#444';

  /* paired strips are always one row per pose, so the 2×2 grid preset doesn't apply */
  const layoutPresets = refs.length ? LAYOUT_PRESETS.filter(p => !PAIRED_EXCLUDED.includes(p.patch.layout)) : LAYOUT_PRESETS;
  const bgLabel = BGS.find(b => b.id === es.bgColor)?.label ?? '';
  const status = busy ? 'Saving…' : rendering ? 'Updating…' : 'Ready';

  return (
    <div className="pb-screen fo">
      <main className="fo-main">
        {/* ── Final strip ── */}
        <section className="fo-prev" aria-label="Final strip preview">
          <span className="fo-status" role="status" aria-live="polite"><i className={rendering || busy ? 'is-busy' : ''} />{status}</span>
          <div className="fo-prev-card">
            {previewUrl
              ? <img src={previewUrl} alt="Your photo strip preview" className={rendering ? 'is-busy' : ''} draggable={false} />
              : <div className="fo-prev-skel" aria-hidden="true" />}
          </div>
        </section>

        <div className="fo-side">
          {/* ── Look: Styles · Frames · Backgrounds (one panel, one set of selections) ── */}
          <section className="pb-card" aria-labelledby={`${uid}-style`}>
            <div className="fo-look-hd">
              <div><span className="pb-eyebrow" id={`${uid}-style`}>Design</span><h2>Pick your look</h2></div>
              <button type="button" className="fo-link fo-link--reset" onClick={resetLook} disabled={isOriginalLook}>Reset to original</button>
            </div>

            <div className="fo-tabs" role="tablist" aria-label="Customization categories" onKeyDown={onTabKey}>
              {lookTabs.map(({ id, label, Icon }) => (
                <button key={id} type="button" role="tab" id={`${uid}-tab-${id}`} aria-selected={tab === id} aria-controls={`${uid}-panel-${id}`}
                        tabIndex={tab === id ? 0 : -1} className="fo-tab" onClick={click(() => setTab(id))}>
                  <Icon size={16} aria-hidden="true" /><span>{label}</span>
                </button>
              ))}
            </div>

            {/* Styles — photo filters, quick looks, adjustments */}
            <div role="tabpanel" id={`${uid}-panel-styles`} aria-labelledby={`${uid}-tab-styles`} hidden={tab !== 'styles'} className="fo-tp">
              <span className="fo-sub">Filter</span>
              <div className="fo-filters" role="radiogroup" aria-label="Photo filters">
                {FILTERS.map(f => (
                  <button key={f.id} type="button" role="radio" aria-checked={f.id === filterId} className="fo-fi"
                          onClick={click(() => onFilterChange(f.id))}>
                    <span className="fo-fi-t">{thumbs[f.id] && <img src={thumbs[f.id]} alt="" draggable={false} />}
                      {f.id === filterId && <span className="fo-th-ck" aria-hidden="true"><Check size={12} /></span>}</span>
                    <span className="fo-fi-l">{f.label}</span>
                  </button>
                ))}
              </div>
              {filterId !== 'normal' && <Slider label="Filter intensity" value={intensity} min={0} max={100} suffix="%" onChange={onIntensityChange} />}

              <span className="fo-sub">Quick looks</span>
              <div className="fo-thumbs" role="radiogroup" aria-label="Quick looks (frame + background together)">
                {STYLE_PRESETS.map(p => (
                  <Thumb key={p.id} label={p.label} src={lookThumbs[`look:${p.id}`]} selected={es.stylePreset === p.id}
                         fallback={swatchBg(p.patch.bgColor)} tag={p.id === 'classic' ? 'Default' : null} onSelect={() => applyPreset(p.id)} />
                ))}
              </div>

              <Section id="adjust" icon={<Sparkles size={18} />} title="Adjust" open={open === 'adjust'} onToggle={toggle('adjust')}>
                {ADJUSTS.map(a => (
                  <Slider key={a.key} label={a.label} value={adjustments[a.key] ?? 0} min={a.min} max={a.max}
                          onChange={v => onStateChange({ adjustments: { ...adjustments, [a.key]: v } })} />
                ))}
                <button type="button" className="fo-link"
                        onClick={click(() => onStateChange({ adjustments: { brightness: 100, contrast: 100, saturation: 100, grain: 0 } }))}>Reset adjustments</button>
              </Section>
            </div>

            {/* Frames — each thumbnail is the real frame on your photos */}
            <div role="tabpanel" id={`${uid}-panel-frames`} aria-labelledby={`${uid}-tab-frames`} hidden={tab !== 'frames'} className="fo-tp">
              <div className="fo-thumbs" role="radiogroup" aria-label="Frames">
                {FRAMES.map(f => (
                  <Thumb key={f.id} label={f.label} src={lookThumbs[`frame:${f.id}`]} selected={es.frameStyle === f.id}
                         fallback={swatchBg(es.bgColor)} tag={f.id === 'classic' ? 'Default' : null} onSelect={() => pickFrame(f.id)} />
                ))}
              </div>
            </div>

            {/* Layouts — the four-photo layouts, each thumbnail drawn on your photos */}
            {!refs.length && (
              <div role="tabpanel" id={`${uid}-panel-layouts`} aria-labelledby={`${uid}-tab-layouts`} hidden={tab !== 'layouts'} className="fo-tp">
                <div className="fo-thumbs" role="radiogroup" aria-label="Layouts">
                  {TRY_LAYOUTS.map(p => (
                    <Thumb key={p.id} label={p.label} src={lookThumbs[`layout:${p.id}`]} selected={layoutIs(p)}
                           fallback={swatchBg(es.bgColor)} tag={p.id === 'classic' ? 'Default' : null} onSelect={() => pickLayout(p)} />
                  ))}
                </div>
                {COMPOSED_NOTE_LAYOUTS.includes(es.layout) && (
                  <p className="text-xs leading-relaxed text-oln-mute">Postcard and Polaroid have their own design, so text, stickers and frame choices don’t change them.</p>
                )}
              </div>
            )}

            {/* Backgrounds — colour and pattern, painted behind the photos so they never cover a subject or frame */}
            <div role="tabpanel" id={`${uid}-panel-backgrounds`} aria-labelledby={`${uid}-tab-backgrounds`} hidden={tab !== 'backgrounds'} className="fo-tp">
              <span className="fo-sub">Colour</span>
              <div className="fo-thumbs" role="radiogroup" aria-label="Background colour">
                {BGS.map(b => (
                  <Thumb key={b.id} label={b.label} src={lookThumbs[`bgc:${b.id}`]} selected={es.bgColor === b.id}
                         fallback={swatchBg(b.id)} tag={b.id === 'cream' ? 'Default' : null} onSelect={() => pickBgColor(b.id)} />
                ))}
              </div>
              <span className="fo-sub">Pattern</span>
              <div className="fo-thumbs" role="radiogroup" aria-label="Background pattern">
                {BG_STYLES.map(b => (
                  <Thumb key={b.id} label={b.label} src={lookThumbs[`bgs:${b.id}`]} selected={es.bgStyle === b.id}
                         fallback={swatchBg(es.bgColor)} tag={b.id === 'solid' ? 'Default' : null} onSelect={() => pickBgStyle(b.id)} />
                ))}
              </div>
            </div>
          </section>

          {/* ── Customize ── */}
          <section className="pb-card" aria-labelledby={`${uid}-cust`}>
            <div><span className="pb-eyebrow" id={`${uid}-cust`}>Customize</span><h2>Make it yours</h2></div>

            <div className="fo-rows">
              {!lockedWatermark && (
                <div className={`fo-row ${es.showCaption ? '' : 'is-off'}`}>
                  <Type size={18} aria-hidden="true" />
                  <input className="fo-in" value={es.caption} maxLength={24} disabled={!es.showCaption} placeholder="Name" aria-label="Name"
                         onChange={e => onStateChange({ caption: e.target.value })} />
                  <Switch on={es.showCaption} label="Show name" onChange={click(() => onStateChange({ showCaption: !es.showCaption }))} />
                </div>
              )}
              <div className={`fo-row ${es.showText ? '' : 'is-off'}`}>
                <Type size={18} aria-hidden="true" />
                <input className="fo-in" value={es.text} maxLength={32} disabled={!es.showText} placeholder="Caption" aria-label="Caption"
                       onChange={e => onStateChange({ text: e.target.value })} />
                <Switch on={es.showText} label="Show caption" onChange={click(() => onStateChange({ showText: !es.showText }))} />
              </div>
              <div className={`fo-row ${es.showDate ? '' : 'is-off'}`}>
                <Calendar size={18} aria-hidden="true" />
                <span className="fo-in fo-in--label">Date<small>{dateLabel(es.dateFormat)}</small></span>
                <Switch on={es.showDate} label="Show date" onChange={click(() => onStateChange({ showDate: !es.showDate }))} />
              </div>
            </div>

            <Section id="text" icon={<Type size={18} />} title="Text" value={`${es.textPos === 'top' ? 'Top' : 'Bottom'} · ${SIZES.find(s => s.id === es.fontSize)?.label}`}
                     open={open === 'text'} onToggle={toggle('text')}>
              <Field label="Position"><Segmented label="Text position" value={es.textPos} options={POS} onChange={v => onStateChange({ textPos: v })} /></Field>
              <Field label="Font size"><Segmented label="Font size" value={es.fontSize} options={SIZES} onChange={v => onStateChange({ fontSize: v })} /></Field>
            </Section>

            <Section id="date" icon={<Calendar size={18} />} title="Date" value={dateLabel(es.dateFormat)} open={open === 'date'} onToggle={toggle('date')}>
              <Field label="Date format"><Dropdown label="Date format" value={es.dateFormat} options={DATE_FORMATS} onChange={v => onStateChange({ dateFormat: v })} /></Field>
              <Field label="Position"><Segmented label="Date position" value={es.datePos} options={POS} onChange={v => onStateChange({ datePos: v })} /></Field>
            </Section>

            <Section id="layout" icon={<Frame size={18} />} title="Layout" open={open === 'layout'} onToggle={toggle('layout')}>
              {showLayoutPresets && (
                <Field label="Strip layout">
                  <Dropdown label="Strip layout" value={layoutPresets.find(p => p.patch.layout === (es.layout || 'strip') && p.patch.frameStyle === es.frameStyle)?.id ?? 'custom'}
                            options={[...layoutPresets, { id: 'custom', label: 'Custom' }]}
                            onChange={id => { const p = layoutPresets.find(x => x.id === id); if (p) { playClick(soundEnabled); onStateChange({ ...BASE_LAYOUT, ...p.patch, ...(refs.length ? { layout: 'strip' } : {}), stylePreset: 'custom' }); } }} />
                </Field>
              )}
              <Slider label="Photo spacing" value={toPct(es.spacing)} min={0}   max={10}  step={0.5} suffix="%" onChange={v => edit({ spacing: toPx(v) })} />
              <Slider label="Padding"       value={toPct(es.padding)} min={1.5} max={10}  step={0.5} suffix="%" onChange={v => edit({ padding: toPx(v) })} />
              <Slider label="Border"        value={toPct(es.border)}  min={0}   max={4}   step={0.5} suffix="%" onChange={v => edit({ border: toPx(v) })} />
              <Slider label="Border radius" value={toPct(es.radius)}  min={0}   max={6.5} step={0.5} suffix="%" onChange={v => edit({ radius: toPx(v) })} />
            </Section>

            <Section id="deco" icon={<Star size={18} />} title="Decorations" value={es.stickers.length ? `${es.stickers.length} on` : 'None'} open={open === 'deco'} onToggle={toggle('deco')}>
              <Field label="Stickers">
                <div className="fo-stickers" role="group" aria-label="Stickers">
                  {STICKERS.map(({ id, label, Icon }) => (
                    <button key={id} type="button" className="fo-sticker" aria-pressed={es.stickers.includes(id)} aria-label={label} title={label}
                            onClick={() => toggleSticker(id)}><Icon size={18} aria-hidden="true" /></button>
                  ))}
                </div>
              </Field>
              <Field label="Sticker colour">
                <div className="fo-swatches" role="radiogroup" aria-label="Sticker colour">
                  {STICKER_COLORS.map(c => (
                    <button key={c.id} type="button" role="radio" aria-checked={es.stickerColor === c.id} aria-label={c.label} title={c.label}
                            className="fo-swatch" style={{ '--c': c.c }} onClick={click(() => onStateChange({ stickerColor: c.id }))} />
                  ))}
                </div>
              </Field>
              <Slider label="Sticker size" value={es.stickerSize} min={0.6} max={1.6} step={0.1} suffix="×" onChange={v => onStateChange({ stickerSize: Math.round(v * 10) / 10 })} />
            </Section>

            <div className="fo-actions">
              <button type="button" className="pb-btn pb-btn--primary fo-act-dl" onClick={handleDownload} disabled={busy} aria-label="Download PNG"><Download size={18} /><span>Download</span></button>
              <button type="button" className="pb-btn pb-btn--ghost" onClick={toggleShare} disabled={busy} aria-expanded={shareOpen} aria-label="Share"><Share2 size={18} /><span>Share</span></button>
              <button type="button" className="pb-btn pb-btn--ghost" onClick={handlePrint} disabled={busy} aria-label="Print"><Printer size={18} /><span>Print</span></button>
              <button type="button" className="pb-btn pb-btn--ghost" onClick={handleDelete} disabled={busy} aria-label="Delete photos"><Trash2 size={18} /><span>Delete</span></button>
            </div>
            {shareOpen && (
              <section aria-labelledby="fo-share-h" className="flex flex-col gap-4 rounded-2xl border-[3px] border-oln-edge bg-oln-dark/60 p-4">
                <h2 id="fo-share-h" className="text-center text-sm font-bold text-oln-cream">Scan to download</h2>
                {qrSrc ? (
                  <>
                    <div className="flex flex-col items-center gap-3">
                      <img src={qrSrc} alt="QR code. Scan it with your phone camera to download your photo strip." className="h-44 w-44 shrink-0 rounded-lg bg-white p-2" />
                      <p className="text-center text-sm text-oln-mute">Point your phone camera at the code and tap the link that appears. Your strip downloads straight to your phone.</p>
                      <a href={shareUrl} className="break-all text-center text-sm font-bold text-oln-pink underline underline-offset-4 min-h-[44px] inline-flex items-center">Download strip</a>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <button type="button" onClick={handleShareQr} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-oln-pink px-3 text-sm font-extrabold text-oln-dark shadow-[0_3px_0_#191516]"><QrCode size={16} aria-hidden="true" />Share QR code</button>
                      <button type="button" onClick={handleDownloadQr} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-oln-edge px-3 text-sm font-extrabold text-oln-cream"><Download size={16} aria-hidden="true" />Save QR code</button>
                      <button type="button" onClick={copyLink} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-oln-edge px-3 text-sm font-extrabold text-oln-cream">Copy download link</button>
                    </div>
                    <p className="text-center text-xs text-oln-mute">Anyone with this link can download the strip until {expiresAt ? new Date(expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'it expires'}. The link stops working after 24 hours. Make a new code after you change the design.</p>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-center text-sm text-oln-mute">Make a QR code that downloads this strip to a phone. The link works for 24 hours.</p>
                    <button type="button" onClick={makeDownloadQr} disabled={busy} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-oln-pink px-4 text-sm font-extrabold text-oln-dark shadow-[0_3px_0_#191516] disabled:opacity-50"><QrCode size={16} aria-hidden="true" />Create download QR code</button>
                  </div>
                )}
              </section>
            )}
            <p className={`fo-msg ${msg.err ? 'is-err' : ''}`} role="status" aria-live="polite">
              {busy ? 'Preparing your full-resolution strip…' : msg.text}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}