import { useEffect } from 'react';
import { X } from '../icons.jsx';

/** Countdown overlay: ring + number, shot pill, cancel. Esc cancels. */
export default function Countdown({ value, currentShot, totalShots, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  if (value === null && !currentShot) return null;

  return (
    <div className="cd" role="status" aria-live="assertive" aria-atomic="true">
      {currentShot > 0 && (
        <div className="cd-pill">
          <span>Photo {currentShot} of {totalShots}</span>
          <span className="cd-dots" aria-hidden="true">
            {Array.from({ length: totalShots }).map((_, i) => (
              <span key={i} className={`cd-dot ${i < currentShot - 1 ? 'cd-dot--done' : ''} ${i === currentShot - 1 ? 'cd-dot--now' : ''}`} />
            ))}
          </span>
        </div>
      )}
      {value !== null && (
        <div className="cd-ring" key={value}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="t" cx="50" cy="50" r="46" />
            <circle className="p" cx="50" cy="50" r="46" />
          </svg>
          <span className="cd-num" aria-label={String(value)}>{value}</span>
        </div>
      )}
      <button type="button" className="cd-cancel" onClick={onCancel} aria-label="Cancel capture (Esc)">
        <X size={14} aria-hidden="true" />
        Cancel
      </button>
    </div>
  );
}
