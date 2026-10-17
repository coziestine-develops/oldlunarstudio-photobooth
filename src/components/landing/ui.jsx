/**
 * Reusable landing-page primitives: icons, Button, Section, Card.
 * Icons are Font Awesome (see ../../icons.jsx).
 */

import {
  Camera, ChevronLeft, ChevronRight, Contrast, Download, Frame, Image, Images, Keyboard, LayoutGrid, Lock, Mobile,
  Plus, RotateCcw, Share2, Shield, Sliders, Star, Stopwatch, Volume2, WandSparkles, X,
} from '../../icons.jsx';

const ICONS = {
  camera: Camera, sliders: Sliders, timer: Stopwatch, download: Download, filter: Contrast, images: Images,
  layout: LayoutGrid, wand: WandSparkles, image: Image, volume: Volume2, shield: Shield, lock: Lock,
  frame: Frame, sticker: Star, retake: RotateCcw, keyboard: Keyboard, mobile: Mobile,
  left: ChevronLeft, right: ChevronRight, plus: Plus, share: Share2, close: X,
};

export function Icon({ name, size = 20, label, className = '' }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return (
    <Glyph
      className={`lp-icon ${className}`}
      size={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? 'false' : 'true'}
      focusable="false"
    />
  );
}

/** variant: primary (red) | secondary (charcoal) | outline (thin pill) */
export function Button({ variant = 'primary', icon, children, className = '', ...rest }) {
  return (
    <button type="button" className={`lp-btn lp-btn--${variant} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      <span>{children}</span>
    </button>
  );
}

/** Section with one heading (title (accent word via <em>) + optional subtitle). */
export function Section({ id, title, subtitle, children, className = '', aside }) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} className={`lp-section ${className}`} aria-labelledby={headingId}>
      <div className="lp-container">
        <header className="lp-section-head fade-up">
          <div>
            <h2 id={headingId} className="lp-section-title">{title}</h2>
            {subtitle && <p className="lp-section-sub">{subtitle}</p>}
          </div>
          {aside}
        </header>
        {children}
      </div>
    </section>
  );
}

export function Card({ icon, title, children, step, tone = 'light', className = '' }) {
  return (
    <div className={`lp-card lp-card--${tone} fade-up ${className}`}>
      {step && <span className="lp-card-step">{step}</span>}
      {icon && <span className="lp-card-icon"><Icon name={icon} size={22} /></span>}
      <h3 className="lp-card-title">{title}</h3>
      <p className="lp-card-desc">{children}</p>
    </div>
  );
}