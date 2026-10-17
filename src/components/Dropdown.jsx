import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from '../icons.jsx';

/**
 * Accessible dropdown. The list is portalled to <body> and positioned with
 * `fixed` coordinates, so it is never clipped by a card / accordion and
 * always stays inside the viewport (flips upward when there is no room below).
 *
 * options: [{ id, label }]
 */
export default function Dropdown({ value, options, onChange, label, placeholder = 'Select', disabled = false, onOpenChange }) {
  const uid = useId();
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [active, setActive] = useState(0);

  const selIdx = options.findIndex(o => o.id === value);
  const selected = selIdx >= 0 ? options[selIdx] : null;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth, gap = 6, margin = 10;
    const want = Math.min(options.length * 42 + 14, 320);
    const below = vh - r.bottom - gap - margin;
    const above = r.top - gap - margin;
    const up = below < Math.min(want, 180) && above > below;
    const maxH = Math.max(120, Math.min(want, up ? above : below));
    const width = Math.min(Math.max(r.width, 190), vw - margin * 2);
    const left = Math.min(Math.max(margin, r.right - width), vw - width - margin);
    setPos({ left, width, maxH, top: up ? undefined : r.bottom + gap, bottom: up ? vh - r.top + gap : undefined });
  }, [options.length]);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  useEffect(() => { onOpenChange?.(open); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!open) return;
    place();
    setActive(selIdx >= 0 ? selIdx : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const reflow = () => place();
    const outside = e => {
      if (listRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close();
    };
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, place, close]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, pos]);

  const choose = i => { const o = options[i]; if (o) onChange(o.id); close(true); };

  const onBtnKey = e => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); }
  };
  const onListKey = e => {
    const n = options.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + n) % n); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(true); }
  };

  return (
    <>
      <button type="button" ref={btnRef} className="pb-dd" aria-haspopup="listbox" aria-expanded={open}
              aria-controls={open ? `${uid}-list` : undefined} aria-label={label ? `${label}: ${selected?.label ?? placeholder}` : undefined}
              disabled={disabled} onClick={() => setOpen(o => !o)} onKeyDown={onBtnKey}>
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {open && pos && createPortal(
        <div ref={listRef} id={`${uid}-list`} className="pb pb-pop" role="listbox" tabIndex={-1} aria-label={label}
             aria-activedescendant={`${uid}-o${active}`} onKeyDown={onListKey}
             style={{ left: pos.left, width: pos.width, maxHeight: pos.maxH, top: pos.top, bottom: pos.bottom }}>
          {options.map((o, i) => (
            <div key={o.id} id={`${uid}-o${i}`} data-i={i} role="option" aria-selected={o.id === value}
                 className={`pb-opt ${i === active ? 'is-active' : ''}`}
                 onPointerEnter={() => setActive(i)} onClick={() => choose(i)}>
              <span>{o.label}</span>
              {o.id === value && <Check size={16} strokeWidth={2.4} aria-hidden="true" />}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
