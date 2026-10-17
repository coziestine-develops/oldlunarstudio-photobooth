import { useState, useEffect } from 'react';
import { Moon, Users, ArrowRight, WandSparkles, Camera, Sparkles } from '../icons.jsx';

import { playClick } from '../utils/sounds.js';
import { FILTERS } from '../utils/filters.js';
import { Button, Section, Card, Icon } from './landing/ui.jsx';
import { builderToDesign } from '../utils/share.js';
import './landing/landing.css';

/* Sections of the page: used by the top navigation and the footer. */
const NAV = [
  { id: 'modes', label: 'Modes' },
  { id: 'how', label: 'How it works' },
  { id: 'features', label: 'Features' },
  { id: 'builder', label: 'Builder' },
  { id: 'faq', label: 'FAQ' },
];

/* ── Scroll fade-up (CSS handles prefers-reduced-motion) ── */
function useFadeUp() {
  useEffect(() => {
    const els = document.querySelectorAll('.lp .fade-up');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ── Content ── */
const STEPS = [
  { icon: 'camera',   title: 'Set up camera',  desc: <>Allow camera access and get ready.</> },
  { icon: 'timer',    title: 'Smile',          desc: <>Pick a 3–15 second countdown, hit start, and 4 shots fire one by one.</> },
  { icon: 'images',   title: 'Review',         desc: <>Reorder your shots with the arrows or drag, and retake any you don’t love.</> },
  { icon: 'download', title: 'Final output',   desc: <>Pick a filter, frame, background, text and decorations, then download, share or print.</> },
];

const FAQ_ITEMS = [
  { q: 'How does the photobooth work?', a: 'Choose your setup, get ready, and let the countdown begin. The photobooth captures your photos automatically, then lets you review them and style your photo strip.' },
  { q: 'Can I take photos with my friends?', a: 'Absolutely! Grab your friends, family, or anyone you want in the frame. Or try PairSnap, where two people match four poses together.' },
  { q: 'Can I retake my photos?', a: 'Yes. On the review screen you can retake any single shot, or start another session and try again until you get the perfect set.' },
  { q: 'What can I customize?', a: 'Pick one of 8 filters, then fine-tune brightness, contrast, saturation and grain. Choose a frame, background color and pattern, add a name, caption, date and decorations, and adjust spacing, padding, border and corners.' },
  { q: 'Can I download my photo strip?', a: 'Yes! In the final output you can save your finished strip as a high-resolution PNG, share it, or print it straight from your device.' },
];

/* ── FAQ: one open at a time, height animation via grid rows ── */
function Faq() {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div className="lp-faq fade-up">
      {FAQ_ITEMS.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={item.q} className={`lp-faq-item ${open ? 'is-open' : ''}`}>
            <h3>
              <button
                type="button"
                className="lp-faq-q"
                id={`faq-btn-${i}`}
                aria-expanded={open}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpenIdx(open ? null : i)}
              >
                <span>{item.q}</span>
                <span className="lp-faq-icon" aria-hidden="true"><Icon name="plus" size={20} /></span>
              </button>
            </h3>
            <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} className="lp-faq-panel">
              <div className="lp-faq-panel-inner"><p>{item.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Fanned photo strips (pure CSS) ── */
function StripFan() {
  const strips = ['left', 'center', 'right'];
  return (
    <div className="lp-fan-wrap" aria-hidden="true">
      <div className="lp-fan">
        {strips.map(pos => (
          <div key={pos} className={`lp-fan-strip lp-fan-strip--${pos}`}>
            {[0, 1, 2, 3].map(n => (
              <div key={n} className="lp-fan-frame"><span className="lp-fan-person" /></div>
            ))}
            <span className="lp-fan-brand">OLDLUNAR STUDIO</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Feature card ── */
function Feature({ icon, title, size = 'sm', children, extra, points = [] }) {
  const iconNode = typeof icon === 'string' ? <Icon name={icon} size={22} /> : icon;

  return (
    <div className={`lp-feat lp-feat--${size} fade-up`}>
      <span className="lp-feat-icon">{iconNode}</span>
      <h3 className="lp-feat-title">{title}</h3>
      <p className="lp-feat-desc">{children}</p>
      {points.length > 0 && (
        <ul className="lp-feat-points">
          {points.map(pt => <li key={pt}>{pt}</li>)}
        </ul>
      )}
      {extra}
    </div>
  );
}

/* ── Strip builder (interactive) ── */
const B_LAYOUTS = [
  { id: 'strip',   label: 'Strip',  cols: 1, count: 4, w: 172 },
];
const B_FRAMES = [
  { id: 'none', label: 'Classic' }, { id: 'thin', label: 'Thin' }, { id: 'thick', label: 'Thick' },
  { id: 'rounded', label: 'Rounded' }, { id: 'film', label: 'Film' },
];
const B_COLORS = [
  { id: 'cream', label: 'Soft Cream',     bg: '#F2EBE7', tx: '#191516' },
  { id: 'clean', label: 'Pure White',     bg: '#FFFFFF', tx: '#000000' },
  { id: 'black', label: 'Midnight Black', bg: '#191516', tx: '#F2EBE7' },
  { id: 'film',  label: 'Vintage Film',   bg: '#C8BBA5', tx: '#29231F' },
  { id: 'pink',  label: 'OldLunar Pink',  bg: '#EB6380', tx: '#191516' },
];

const Chips = ({ items, value, onChange, label }) => (
  <div role="radiogroup" aria-label={label} className="lp-chips">
    {items.map(i => (
      <button key={i.id} type="button" role="radio" aria-checked={value === i.id}
        className={`lp-chip ${value === i.id ? 'is-active' : ''}`} onClick={() => onChange(i.id)}>
        {i.glyph ? <span aria-hidden="true">{i.glyph}</span> : null}{i.label}
      </button>
    ))}
  </div>
);

const B_DEFAULT = { frame: 'thin', color: 'pink', caption: '', showDate: true };
const BRAND = 'OLDLUNAR STUDIO';

/** Controlled: LandingPage owns the design so the Share button and the camera flow can use it. */
function StripBuilder({ design, onChange, onStart }) {
  const layout = 'strip';
  const { frame, color, caption, showDate } = design;
  const setFrame    = v => onChange({ frame: v });
  const setColor    = v => onChange({ color: v });
  const setCaption  = v => onChange({ caption: v });
  const setShowDate = fn => onChange({ showDate: typeof fn === 'function' ? fn(showDate) : fn });

  const L = B_LAYOUTS.find(l => l.id === layout);
  const C = B_COLORS.find(c => c.id === color);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const reset = () => onChange(B_DEFAULT);
  const shuffle = () => {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)].id;
    onChange({ frame: pick(B_FRAMES), color: pick(B_COLORS) });
  };

  return (
    <div className="lp-build fade-up">
      <div className="lp-build-panel">
        <div><p className="lp-group-label">Frame</p><Chips items={B_FRAMES} value={frame} onChange={setFrame} label="Frame style" /></div>
        <div>
          <p className="lp-group-label">Strip color</p>
          <div className="lp-colors" role="radiogroup" aria-label="Strip color">
            {B_COLORS.map(c => (
              <button key={c.id} type="button" role="radio" aria-checked={color === c.id} aria-label={c.label} title={c.label}
                className={`lp-color ${color === c.id ? 'is-active' : ''}`} style={{ '--c': c.bg }} onClick={() => setColor(c.id)} />
            ))}
          </div>
        </div>
        <div>
          <div className="lp-caption-group">
            <label htmlFor="lp-caption" className="lp-group-label">
              Caption
            </label>

            <input
              id="lp-caption"
              name="caption"
              type="text"
              className="lp-input"
              value={caption ?? ""}
              maxLength={24}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              aria-label="Caption"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <button type="button" role="switch" aria-checked={showDate} className={`lp-chip ${showDate ? 'is-active' : ''}`} onClick={() => setShowDate(v => !v)}>
            <Icon name="timer" size={16} />Date stamp
          </button>
        </div>
        <div className="lp-build-actions">
          <Button variant="outline" icon="wand" onClick={shuffle}>Surprise me</Button>
          <Button variant="outline" icon="retake" onClick={reset}>Reset</Button>
        </div>
      </div>

      <div className="lp-stage" aria-live="polite">
        <div className={`lp-sheet lp-sheet--${frame} lp-sheet--${layout}`} style={{ '--bd': C.bg, '--tx': C.tx, '--sw': `${L.w}px` }}>
          <div className="lp-sheet-grid">
            {Array.from({ length: L.count }).map((_, i) => <div className="lp-cell" key={i} />)}
          </div>
          <div className="lp-sheet-meta">
            <p className="lp-sheet-brand">{BRAND}</p>
            {(caption ?? '').trim() && <p className="lp-sheet-cap">{caption}</p>}
            {showDate && <p className="lp-sheet-date">{date}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onStart, onStartPairSnap, onStartPhotoPop, soundEnabled }) {
  useFadeUp();

  /* Builder design */
  const [designBase, setDesignBase] = useState(() => { const { caption: _c, ...rest } = B_DEFAULT; return rest; });
  const [caption, setCaption] = useState("");
  const design = { ...designBase, caption };
  const [touched, setTouched] = useState(false);   // only carry the design into the booth if the visitor chose one

  const patchDesign = ({ caption: nextCaption, ...rest }) => {
    if (nextCaption !== undefined) setCaption(nextCaption ?? "");
    if (Object.keys(rest).length) setDesignBase(d => ({ ...d, ...rest }));
    setTouched(true);
  };
  const currentDesign = () => builderToDesign(design);

  /* Mobile menu: closes on Escape or when a link is tapped */
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleStart = () => { playClick(soundEnabled); onStart(touched ? currentDesign() : null); };
  const handleShootDesign = () => { playClick(soundEnabled); onStart(currentDesign()); };

  const swatches = (
    <ul className="lp-filter-list" aria-label="Available filters">
      {FILTERS.map(f => (
        <li key={f.id} className="lp-filter-item">
          <strong className="lp-hl-title">{f.label}</strong>
          <small>{f.tagline}</small>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-container lp-top-in">
          <a href="#top" className="lp-wordmark" aria-label="OldLunar Studio, back to top" onClick={closeMenu}>
            <Moon size={18} aria-hidden="true" />
            <span>Old<span className="lp-luna">Lunar</span><span style={{ color: "#C9A66B" }}> Studio</span></span>
          </a>
          <nav className="lp-nav" aria-label="Page sections">
            {NAV.map(n => <a key={n.id} href={`#${n.id}`}>{n.label}</a>)}
          </nav>

          <div className="lp-top-right">
            <button type="button" className={`lp-burger ${menuOpen ? 'is-open' : ''}`} aria-expanded={menuOpen}
              aria-controls="lp-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(o => !o)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id="lp-menu" className="lp-menu" role="navigation" aria-label="Menu">
            {NAV.map(n => <a key={n.id} href={`#${n.id}`} onClick={closeMenu}>{n.label}</a>)}
          </div>
        )}
      </header>
      <main>
        {/* ── Hero ── */}
        <div className="lp-hero" id="top">
          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-text">
              <span className="lp-eyebrow"><Sparkles size={14} aria-hidden="true" />Photobooth in your browser</span>
              <h1 className="lp-h1">Memories made into <span className="lp-hl-title">photo strips.</span></h1>
              <p className="lp-lead">Take four photos, then make the strip yours with filters, frames, backgrounds, decorations and text. Download, share or print it in high resolution.</p>
              <div className="lp-cta-group">
                
                <a className="lp-btn lp-btn--outline lp-btn--lg" href="#modes">Explore modes <ArrowRight size={18} aria-hidden="true" /></a>
              </div>
              <ul className="lp-trust" aria-label="Highlights">
                <li><Icon name="lock" size={14} />Photos stay on your device</li>
                <li><Icon name="mobile" size={14} />Works on phone and laptop</li>
                <li><Icon name="download" size={14} />No app to install</li>
              </ul>
            </div>
            <StripFan />
          </div>
        </div>

        <section id="modes" className="lp-section lp-section--modes" aria-labelledby="modes-heading">
          <div className="lp-container">
            <header className="lp-section-head fade-up">
              <div>
                <h2 id="modes-heading" className="lp-section-title">Pick a <span className="lp-hl-title">mode</span></h2>
                <p className="lp-section-sub">Three quick ways to get your photo strip. Choose one to start.</p>
              </div>
            </header>
            <div className="lp-modes">
              <button type="button" className="lp-mode lp-mode--start fade-up" onClick={handleStart}>
                <span className="lp-mode-body">
                  <span className="lp-mode-tag"><Camera size={14} aria-hidden="true" />Classic</span>
                  <span className="lp-mode-title">Start photobooth</span>
                  <span className="lp-mode-desc">Set your countdown, take four photos, then edit filters, frames and text on your strip.</span>
                  <span className="lp-mode-cta">Start photobooth <ArrowRight size={18} aria-hidden="true" /></span>
                </span>
              </button>
              {onStartPhotoPop && (
                <button type="button" className="lp-mode lp-mode--pop fade-up" onClick={() => { playClick(soundEnabled); onStartPhotoPop(); }}>
                  <span className="lp-mode-body">
                    <span className="lp-mode-tag"><WandSparkles size={14} aria-hidden="true" />One tap</span>
                    <span className="lp-mode-title">PhotoPop Presets</span>
                    <span className="lp-mode-desc">Pick a ready-made template, take four photos and download your strip. Fastest way to a finished look.</span>
                    <span className="lp-mode-cta">Open PhotoPop <ArrowRight size={18} aria-hidden="true" /></span>
                  </span>
                </button>
              )}
              {onStartPairSnap && (
                <button type="button" className="lp-mode lp-mode--pair fade-up" onClick={() => { playClick(soundEnabled); onStartPairSnap(); }}>
                  <span className="lp-mode-body">
                    <span className="lp-mode-tag"><Users size={14} aria-hidden="true" />For two</span>
                    <span className="lp-mode-title">PairSnap</span>
                    <span className="lp-mode-desc">Two people, four poses. Choose your references, then recreate them together, one shot at a time.</span>
                    <span className="lp-mode-cta">Open PairSnap <ArrowRight size={18} aria-hidden="true" /></span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>

        <Section id="how" title={<><span>How it</span> <span className="lp-hl-title">works.</span></>}
          subtitle="Create, customize, and enjoy your photo strip in four steps.">
          <div className="lp-grid lp-grid--4 lp-steps">
            {STEPS.map((s, i) => (
              <Card key={s.title} step={String(i + 1).padStart(2, '0')} icon={s.icon} title={s.title}>{s.desc}</Card>
            ))}
          </div>
        </Section>
        <Section id="features" title={<><span>All Features</span> <span className="lp-hl-title">included</span></>}
          subtitle="Everything you need for the perfect photo strip.">
          <div className="lp-bento">
            <Feature size="xl" icon="filter" title="8 filters" extra={swatches}
              points={['Filter strength from 0 to 100%', 'Brightness, contrast, saturation and grain sliders', 'Filters are applied to a copy, so your photos are never changed', 'Reset the look with one tap']}>
              Eight colour looks, from natural to dramatic. Skin tones and facial details stay natural.
            </Feature>
            <Feature icon="layout" title="Strip & layouts"
              points={['Four photos in a classic strip', 'Four-frame grid, postcard and Polaroid prints', 'Layout presets to start from', 'Try any layout on your own photos']}>
              One session, several ways to arrange it.
            </Feature>
            <Feature icon="timer" title="Custom timer"
              points={['3, 5, 7, 10 or 15 seconds before each photo', 'Default is 5 seconds', 'Cancel the countdown with Esc', 'PhotoPop also offers an instant option']}>
              Set the pace for every shot.
            </Feature>
            <Feature icon="wand" title="Photo editor"
              points={['Brightness, contrast, saturation and grain', '8 style presets: Classic, Minimal, Romantic, Film, Vintage, Clean, Dark and Pink', 'Preview updates as you adjust']}>
              Shape the look of your strip, then save it.
            </Feature>
            <Feature icon="frame" title="Frames & backgrounds"
              points={['7 frames: Classic, Minimal, Film, Vintage, Polaroid, Rounded and No Frame', '4 background colours: Cream, White, Dark and Pink', '4 patterns: Plain, Dots, Stripes and Grid']}>
              Frame and background are chosen separately.
            </Feature>
            <Feature icon="sticker" title="Text, date & stickers"
              points={['Caption and text, placed at the top or bottom', 'Text sizes: Small, Medium and Large', '4 date formats, or no date', '6 stickers (star, heart, sparkle, crown, moon, camera) in 3 colours and 3 sizes']}>
              Make the strip personal.
            </Feature>
            <Feature icon="image" title="Download, share or print"
              points={['Download a high-resolution PNG', 'Print straight from the editor', 'Share through your device’s share sheet', 'QR code: uploads a copy of the strip for a temporary download link']}>
              Keep your strip in the format you need.
            </Feature>
            <Feature icon="images" title="Review & retake"
              points={['Reorder shots with the arrows or by dragging', 'Retake any single shot', 'Continue to editing when you are happy']}>
              Check every shot before you finish.
            </Feature>
            <Feature icon="camera" title="Front & back camera"
              points={['Switch cameras when your device has both', 'Runs in your browser, nothing to install']}>
              Use whichever camera suits the moment.
            </Feature>
          </div>
        </Section>
        <Section id="builder" title={<><span>Personalize your</span> <span className="lp-hl-title">strip</span></>}
          subtitle="Customize your frames, colors, and captions. Preview it live and capture your moments.">
          <StripBuilder design={design} onChange={patchDesign} onStart={handleShootDesign} />
        </Section>

        <section className="lp-section lp-section--tight" aria-labelledby="privacy-heading">
          <div className="lp-container">
            <div className="lp-privacy fade-up">
              <span className="lp-privacy-icon"><Icon name="shield" size={30} label="Privacy shield" /></span>
              <div>
                <h2 id="privacy-heading" className="lp-privacy-title">Your photos stay with you</h2>
                <p className="lp-privacy-desc">
                  Photos are processed in your browser and never uploaded by the app.
                  Nothing leaves your device unless you choose to download it.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section" aria-labelledby="faq-heading">
          <div className="lp-container lp-faq-layout">
            <div className="lp-faq-head">
              <header className="lp-section-head fade-up">
                <div>
                 <h2 id="faq-heading" className="lp-section-title">Frequently Asked <span className="lp-hl-title">Questions</span></h2>
                 <p className="lp-section-sub">Quick answers to help you create, customize, and capture your perfect photo strip.</p>
                </div>
              </header>
            </div>
            <Faq />
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-grid">
          <div className="lp-footer-brand">
            <span className="lp-footer-logo">
              <Moon size={18} aria-hidden="true" />
              <span>Old<span className="lp-luna">Lunar</span><span style={{ color: "#C9A66B" }}> Studio</span></span>
            </span>
            <span className="lp-footer-tag"><Sparkles size={12} color="#C9A66B" aria-hidden="true" /> Where little moments become forever.</span>
          </div>

          <div className="lp-footer-meta">
            <span>© 2026 OldLunar Studio.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}