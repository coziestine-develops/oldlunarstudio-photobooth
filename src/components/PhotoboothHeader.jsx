import { ArrowLeft, ArrowRight } from '../icons.jsx';
import './camera.css';

export const STEP_TITLES = ['Setup', 'Photobooth', 'Review', 'Final Output'];

/**
 * Shared header for every photobooth screen.
 * Back (left) · STEP n + title (centre) · Next / counter (right).
 *
 * @param step     1–4
 * @param next     { label, onClick, disabled } — shows "NEXT <label> →" top-right
 * @param counter  e.g. "2/4" while capturing (replaces `next`)
 */
export default function PhotoboothHeader({ step = 1, onBack, backDisabled = false, next = null, counter = null, titles = STEP_TITLES, className = '' }) {
  return (
    <header className={`pb-hd ${className}`.trim()}>
      <div className="pb-hd-in">
        <button type="button" className="pb-hd-back" onClick={onBack} disabled={backDisabled} aria-label="Go back">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          <span>Back</span>
        </button>

        <div className="pb-hd-mid">
          <span className="pb-hd-step">Step {step}</span>
          <h1>{titles[step - 1]}</h1>
        </div>

        <div className="pb-hd-right">
          {counter ? (
            <div className="pb-hd-count" aria-label={`${counter} photos taken`}>{counter}</div>
          ) : next ? (
            <button type="button" className="pb-hd-next" onClick={next.onClick} disabled={next.disabled} aria-label={`Next: ${next.label}`}>
              <span className="pb-hd-next-k">Next</span>
              <span className="pb-hd-next-v">{next.label}<ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" /></span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="pb-prog" style={{ gridTemplateColumns: `repeat(${titles.length}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={1} aria-valuemax={titles.length} aria-valuenow={step} aria-label={`Step ${step} of ${titles.length}`}>
        {titles.map((t, i) => <i key={t} className={i < step ? 'is-on' : ''} />)}
      </div>
    </header>
  );
}