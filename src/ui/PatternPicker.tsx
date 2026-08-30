import React, { useEffect, useRef, useState } from 'react';
import { E, useStore } from '../store/useStore';

const TYPES = [
  { v: 'text', name: 'Glyphs', icon: 'Aa', note: 'Characters mapped to brightness' },
  { v: 'tiles', name: 'Tiles', icon: '◫', note: 'Shapes, symbols or custom artwork' },
  { v: 'braille', name: 'Braille', icon: '⠿', note: 'Compact 2 × 4 dot cells' },
  { v: 'hatch', name: 'Hatch', icon: '╱', note: 'Directional line shading' },
] as const;

export default function PatternPicker() {
  useStore((s) => s.rev);
  const bump = useStore((s) => s.bump);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = TYPES.find((x) => x.v === E.S.mode) || TYPES[0];

  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const choose = (mode: string) => {
    E.S.mode = mode;
    if (mode === 'tiles' && Math.abs(E.S.aspect - .55) < .001) E.S.aspect = 1;
    if (mode !== 'tiles' && Math.abs(E.S.aspect - 1) < .001) E.S.aspect = .55;
    E.schedule(); bump(); setOpen(false);
  };

  return <div className="pattern-picker" ref={ref}>
    <span className="ctl-l">Pattern type</span>
    <button type="button" className="pattern-current" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="pattern-icon">{active.icon}</span>
      <span><b>{active.name}</b><small>{active.note}</small></span>
      <span className="pattern-arrow">▾</span>
    </button>
    {open && <div className="pattern-menu" role="listbox" aria-label="Pattern type">
      {TYPES.map((type) => <button type="button" role="option" aria-selected={type.v === active.v} key={type.v} onClick={() => choose(type.v)}>
        <span className="pattern-icon">{type.icon}</span>
        <span><b>{type.name}</b><small>{type.note}</small></span>
        {type.v === active.v && <span className="pattern-check">✓</span>}
      </button>)}
    </div>}
  </div>;
}
