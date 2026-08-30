import React, { useState } from 'react';
import { E, useStore } from '../store/useStore';

const ICON: any = { text: 'T', rect: '■', circle: '●', line: '─', image: '▣' };

export default function LayersPanel() {
  useStore((s) => s.rev);
  const bump = useStore((s) => s.bump);
  const select = useStore((s) => s.select);
  const [addOpen, setAddOpen] = useState(false), [menu, setMenu] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null), [dragPos, setDragPos] = useState<number | null>(null);
  const st = E.getState(), stack = E.stackTopDown();
  const act = (fn: () => void) => { fn(); E.schedule(); bump(); };
  const add = (kind: string) => act(() => { const o = E.newOverlay(kind); E.setOverlays(E.getState().overlays.concat(o)); E.setOvSel(E.getState().overlays.length - 1); setAddOpen(false); });
  const remove = (i: number) => act(() => { const s = E.getState(), next = s.overlays.slice(); next.splice(i, 1); E.setOverlays(next); if (i < s.artZ) E.setArtZ(s.artZ - 1); E.setOvSel(-1); setMenu(null); });
  const duplicate = (i: number) => act(() => { const s = E.getState(), source = s.overlays[i]; const copy = { ...source, name: source.name ? source.name + ' copy' : '', x: source.x + 3, y: source.y + 3 }; const next = s.overlays.slice(); next.splice(i + 1, 0, copy); E.setOverlays(next); if (i < s.artZ) E.setArtZ(s.artZ + 1); E.setOvSel(i + 1); setMenu(null); });
  const reorder = (from: number, to: number) => act(() => {
    if (from === to) return;
    const state = E.getState(), selected = state.overlays[state.ovSel];
    const display: any[] = E.stackTopDown().map((x: any) => x.t === 'art' ? { art: true } : state.overlays[x.i]);
    const [moving] = display.splice(from, 1); display.splice(to, 0, moving);
    const bottomUp = display.slice().reverse(), artAt = bottomUp.findIndex((x) => x.art);
    const overlays = bottomUp.filter((x) => !x.art);
    E.setOverlays(overlays); E.setArtZ(artAt); E.setOvSel(selected ? overlays.indexOf(selected) : -1);
  });

  return <aside className={'layers' + (collapsed ? ' collapsed' : '')}>
    <div className="lhead"><span className="ctl-l">Layers</span><span className="ctl-v">{st.overlays.length + 1}</span><button className="collapse-layers" type="button" title={collapsed ? 'Expand layers' : 'Collapse layers'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '‹' : '›'}</button></div>
    <div className="layers-content">
    <div className="layer-add-wrap"><button className="layer-add" type="button" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}>+ Add layer</button>
      {addOpen && <div className="layer-add-menu">{['text','rect','circle','line'].map((kind) => <button type="button" key={kind} onClick={() => add(kind)}><span>{ICON[kind]}</span>{kind === 'rect' ? 'Rectangle' : kind[0].toUpperCase() + kind.slice(1)}</button>)}<button type="button" onClick={() => { setAddOpen(false); document.getElementById('layerImg')!.click(); }}><span>{ICON.image}</span>Image</button></div>}
    </div>
    <input id="layerImg" type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (!f) return; E.loadFile(f, (im: any, name: string) => act(() => { const o = E.newOverlay('image'); o.img = im; o.imgName = name.replace(/\.[^.]+$/, ''); o.size = 60; o.h = 40; E.setOverlays(E.getState().overlays.concat(o)); E.setOvSel(E.getState().overlays.length - 1); })); }} />
    <div className="ltree" onClick={() => setMenu(null)}>{stack.map((item: any, pos: number) => {
      const isArt = item.t === 'art', o = isArt ? null : st.overlays[item.i];
      const blend = !isArt && o.blend && o.blend !== 'source-over' ? (o.blend === true ? 'Multiply' : o.blend) : '';
      return <div key={isArt ? 'art' : o} draggable={!isArt && renaming === null} onDragStart={() => setDragPos(pos)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragPos !== null) reorder(dragPos, pos); setDragPos(null); }}
        className={'lrow' + (isArt ? ' art' : '') + (!isArt && item.i === st.ovSel ? ' sel' : '') + (!isArt && o.vis === false ? ' hidden' : '')} onClick={() => select(isArt ? -1 : item.i)}>
        <span className="drag-handle">{isArt ? '' : '⠿'}</span>
        <button className="visibility" title={isArt ? 'Artwork is always visible' : (o.vis === false ? 'Show layer' : 'Hide layer')} disabled={isArt} onClick={(e) => { e.stopPropagation(); if (!isArt) act(() => { o.vis = o.vis === false; }); }}>{isArt || o.vis !== false ? '◉' : '○'}</button>
        <span className={'layer-thumb ' + (isArt ? 'art-thumb' : o.kind)} style={!isArt && o.kind !== 'image' ? { color: o.col } : undefined}>{!isArt && o.kind === 'image' && o.img ? <img src={o.img.src || o.img.toDataURL?.()} alt="" /> : (isArt ? '✣' : ICON[o.kind])}</span>
        <span className="layer-copy">{!isArt && renaming === item.i ? <input autoFocus defaultValue={o.name || E.layerName(o, item.i)} onClick={(e) => e.stopPropagation()} onBlur={(e) => { o.name = e.target.value.trim(); setRenaming(null); bump(); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} /> : <span className="nm" onDoubleClick={(e) => { if (!isArt) { e.stopPropagation(); setRenaming(item.i); } }}>{isArt ? 'Artwork' : E.layerName(o, item.i)}</span>}<span className="layer-meta">{isArt ? `${E.S.mode} pattern` : `${o.kind}${blend ? ' · ' + blend : ''} · ${Math.round(o.op)}%`}</span></span>
        {!isArt && <button className={'lock' + (o.locked ? ' on' : '')} title={o.locked ? 'Unlock layer' : 'Lock layer'} onClick={(e) => { e.stopPropagation(); act(() => { o.locked = !o.locked; }); }}>{o.locked ? '◆' : '◇'}</button>}
        {!isArt && <div className="layer-more-wrap"><button className="layer-more" title="Layer actions" onClick={(e) => { e.stopPropagation(); setMenu(menu === item.i ? null : item.i); }}>•••</button>{menu === item.i && <div className="layer-menu" onClick={(e) => e.stopPropagation()}><button onClick={() => { setRenaming(item.i); setMenu(null); }}>Rename</button><button onClick={() => duplicate(item.i)}>Duplicate</button><button className="danger" onClick={() => remove(item.i)}>Delete</button></div>}</div>}
      </div>;
    })}</div>
    <div className="lfoot"><p className="hint" style={{margin:0}}>Drag to reorder. Double-click a name to rename it.</p></div></div>
  </aside>;
}
