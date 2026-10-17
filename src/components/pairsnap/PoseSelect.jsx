/** PairSnap step 2 — choose exactly four pose references. */
import { useMemo, useState, useRef, useEffect } from 'react';
import { ArrowRight, Camera, Check, LayoutGrid, User, Users, X } from '../../icons.jsx';
import { POSES, POSE_CATEGORIES, poseCounts } from '../../data/poses.js';

const CAT_ICONS = { all: LayoutGrid, solo: User, duo: Users };

export default function PoseSelect({ selectedIds, onChange, total = 4, onContinue }) {
  const [cat, setCat]   = useState('all');
  const [note, setNote] = useState('');
  const noteTimer = useRef(0);
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  const counts  = useMemo(() => poseCounts(POSES), []);
  const visible = useMemo(() => (cat === 'all' ? POSES : POSES.filter(p => p.category === cat)), [cat]);
  const byId    = useMemo(() => Object.fromEntries(POSES.map(p => [p.id, p])), []);

  const flash = text => { setNote(text); clearTimeout(noteTimer.current); noteTimer.current = setTimeout(() => setNote(''), 2600); };

  const toggle = id => {
    if (selectedIds.includes(id)) { onChange(selectedIds.filter(x => x !== id)); return; }  // numbering re-flows from array order
    if (selectedIds.length >= total) { flash(`Only ${total} references allowed. Tap a selected one to swap it out.`); return; }
    onChange([...selectedIds, id]);
  };

  const ready = selectedIds.length === total;

  return (
    <div className="ps-select">
      <div className="ps-sel-head">
        <h2>Choose your {total} references</h2>
        <p>Choose your favorite poses and recreate them together—in the order you select!</p>
        <p className="ps-sel-sub">Turn Moments Into Memories. <Camera size={14} aria-hidden="true" /></p>
      </div>

      <div className="ps-cats" role="tablist" aria-label="Pose categories">
        {POSE_CATEGORIES.map(c => {
          const n = counts[c.id] ?? 0, Icon = CAT_ICONS[c.id], on = cat === c.id;
          return (
            <button key={c.id} type="button" role="tab" aria-selected={on} disabled={n === 0}
                    className={`ps-cat ${on ? 'is-on' : ''}`} onClick={() => setCat(c.id)}>
              <span className="ps-cat-ic" aria-hidden="true"><Icon size={20} strokeWidth={2} /></span>
              <span className="ps-cat-tx"><b>{c.label}</b><small>{n} {n === 1 ? 'pose' : 'poses'}</small></span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="ps-empty">No {cat} poses yet.</p>
      ) : (
        <ul className="ps-grid">
          {visible.map(p => {
            const n = selectedIds.indexOf(p.id) + 1;
            return (
              <li key={p.id}>
                <button type="button" className={`ps-pose ${n ? 'is-sel' : ''}`} aria-pressed={!!n}
                        aria-label={`${p.title}${n ? `, selected as number ${n}` : ''}`} onClick={() => toggle(p.id)}>
                  <img src={p.image} alt={p.title} loading="lazy" draggable="false" />
                  {n > 0 && <span className="ps-badge">{n}</span>}
                  <span className="ps-pose-name">{p.title}</span>
                  {!n && <span className="ps-pose-add" aria-hidden="true">+</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="ps-credit">
Reference photos are used for pose and creative inspiration only. Ownership and rights remain with their respective creators and copyright holders. For removal or credit requests, please contact the developer.      </p>

      <div className="ps-bar" role="region" aria-label="Selected references">
        <p className={`ps-note ${note ? 'is-on' : ''}`} role="status" aria-live="polite">{note}</p>
        <span className="ps-bar-k">Selected</span>
        <span className="ps-bar-count"><b>{selectedIds.length}</b> of {total}</span>
        <div className="ps-bar-slots">
          {Array.from({ length: total }).map((_, i) => {
            const p = byId[selectedIds[i]];
            return p ? (
              <button key={i} type="button" className="ps-slot is-fill" onClick={() => toggle(p.id)} aria-label={`Remove ${p.title} (slot ${i + 1})`}>
                <img src={p.image} alt="" /><span>{i + 1}</span><i aria-hidden="true"><X size={14} /></i>
              </button>
            ) : (
              <span key={i} className="ps-slot">{i + 1}</span>
            );
          })}
        </div>
        <button type="button" className="pb-btn pb-btn--primary ps-bar-go" disabled={!ready} onClick={onContinue}>
            Continue <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}