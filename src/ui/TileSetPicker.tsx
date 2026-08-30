import React from 'react';
import { E, useStore } from '../store/useStore';

/* A visual, icon-driven replacement for the old "Built-in set" <select>.
 * Each button loads its set the moment it's clicked, so there's no dead
 * native-<select> reselect (picking the option already shown as selected
 * fires no change event, so nothing loaded - that was the "circles won't
 * load" bug). A button click always fires. */

const KINDS: { v: string; t: string }[] = [
  { v: 'circles', t: 'Circles' }, { v: 'squares', t: 'Squares' },
  { v: 'triangles', t: 'Triangles' }, { v: 'diamonds', t: 'Diamonds' },
  { v: 'hexagons', t: 'Hexagons' }, { v: 'crosses', t: 'Crosses' },
  { v: 'arcs', t: 'Truchet arcs' }, { v: 'chevrons', t: 'Chevrons' },
  { v: 'dice', t: 'Dice pips' }, { v: 'dicecut', t: 'Dice cut' },
  { v: 'rings', t: 'Rings' }, { v: 'dots', t: 'Halftone dots' },
];

function Icon({ kind }: { kind: string }) {
  const s = { fill: 'currentColor', stroke: 'currentColor' };
  switch (kind) {
    case 'circles': return <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="7.5" {...s} fillOpacity="0" strokeWidth="2.4" /></svg>;
    case 'squares': return <svg viewBox="0 0 24 24" width="20" height="20"><rect x="5" y="5" width="14" height="14" fill="none" {...s} strokeWidth="2.4" /></svg>;
    case 'triangles': return <svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12,4.5 20.5,19.5 3.5,19.5" fill="none" {...s} strokeWidth="2.2" strokeLinejoin="round" /></svg>;
    case 'diamonds': return <svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12,3 21,12 12,21 3,12" fill="none" {...s} strokeWidth="2.2" strokeLinejoin="round" /></svg>;
    case 'hexagons': return <svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12,3.5 19.5,8 19.5,16 12,20.5 4.5,16 4.5,8" fill="none" {...s} strokeWidth="2.2" strokeLinejoin="round" /></svg>;
    case 'crosses': return <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 4v16M4 12h16" fill="none" {...s} strokeWidth="2.6" strokeLinecap="round" /></svg>;
    case 'arcs': return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M3 3a9 9 0 0 1 9 9" fill="none" {...s} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M21 21a9 9 0 0 1-9-9" fill="none" {...s} strokeWidth="2.4" strokeLinecap="round" />
      </svg>);
    case 'chevrons': return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M4 8l8 5 8-5M4 15l8 5 8-5" fill="none" {...s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>);
    case 'dice': return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="none" {...s} strokeWidth="1.8" />
        {[[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.5" {...s} strokeWidth="0" />)}
      </svg>);
    case 'dicecut': return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" {...s} strokeWidth="0" />
        {[[7, 7], [17, 7], [7, 17], [17, 17]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.6" fill="var(--paper-2)" strokeWidth="0" />)}
      </svg>);
    case 'rings': return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="3" fill="none" {...s} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="6.5" fill="none" {...s} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="10" fill="none" {...s} strokeWidth="1.8" />
      </svg>);
    case 'dots': return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        {[[7, 7, 1.2], [17, 7, 2.4], [7, 17, 2.4], [17, 17, 3.4]].map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} {...s} strokeWidth="0" />)}
      </svg>);
    default: return null;
  }
}

export default function TileSetPicker() {
  useStore((s) => s.rev);
  const bump = useStore((s) => s.bump);

  const load = (kind: string) => {
    const label = E.loadTileSet(kind, false);
    E.hooks.onToast(label + ' set loaded');
    bump();
  };
  const clearAll = () => {
    E.setLastTileSet(null);
    E.setLayers(new Array(8).fill(null));
    E.setLayerColors(new Array(8).fill(null));
    E.invalidateTiles();
    E.schedule();
    bump();
  };

  return (
    <div className="ctl">
      <span className="ctl-row"><span className="ctl-l">Built-in set</span></span>
      <div className="tileset-grid">
        {KINDS.map((k) => (
          <button key={k.v} type="button" title={k.t}
                  className={'tileset-btn' + (E.lastTileSet === k.v ? ' active' : '')}
                  onClick={() => load(k.v)}>
            <Icon kind={k.v} />
            <span>{k.t}</span>
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn ghost" type="button" onClick={clearAll}>Clear all</button>
      </div>
    </div>
  );
}
