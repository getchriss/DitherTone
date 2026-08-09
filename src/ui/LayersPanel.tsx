import React from 'react';
import { E, useStore } from '../store/useStore';

const ICON: any = { text: 'T', rect: '\u25a0', circle: '\u25cf', line: '\u2500', image: '\u25a3' };

export default function LayersPanel() {
  useStore((s) => s.rev);
  const bump = useStore((s) => s.bump);
  const select = useStore((s) => s.select);
  const st = E.getState();
  const stack = E.stackTopDown();

  const act = (fn: () => void) => { fn(); E.schedule(); bump(); };

  return (
    <aside className="layers">
      <div className="lhead">
        <span className="ctl-l">Layers</span>
        <span className="ctl-v">{st.overlays.length + 1}</span>
      </div>
      <div className="ladd">
        {['text', 'rect', 'circle', 'line'].map((k) => (
          <button key={k} title={'Add ' + k}
            onClick={() => act(() => {
              const o = E.newOverlay(k);
              E.setOverlays(st.overlays.concat([o]));
              E.setOvSel(E.getState().overlays.length - 1);
            })}>{ICON[k]}</button>
        ))}
        <button title="Place an image" onClick={() => document.getElementById('layerImg')!.click()}>{ICON.image}</button>
      </div>
      <input id="layerImg" type="file" accept="image/*" hidden onChange={(e) => {
        const f = e.target.files?.[0]; (e.target as HTMLInputElement).value = '';
        if (!f) return;
        E.loadFile(f, (im: any, name: string) => act(() => {
          const o = E.newOverlay('image');
          o.img = im; o.imgName = (name || 'image').replace(/\.[^.]+$/, '');
          o.size = 60; o.h = 40;
          E.setOverlays(E.getState().overlays.concat([o]));
          E.setOvSel(E.getState().overlays.length - 1);
        }));
      }} />
      <div className="ltree">
        {stack.map((item: any, pos: number) => {
          const isArt = item.t === 'art';
          const o = isArt ? null : st.overlays[item.i];
          return (
            <div key={pos}
                 className={'lrow' + (isArt ? ' art' : '') +
                   (!isArt && item.i === st.ovSel ? ' sel' : '') +
                   (!isArt && o.vis === false ? ' hidden' : '')}
                 onClick={() => select(isArt ? -1 : item.i)}>
              <span className="ico">{isArt ? '\u25a6' : ICON[o.kind]}</span>
              <span className="nm">{isArt ? 'Artwork' : E.layerName(o, item.i)}</span>
              {isArt
                ? <span className="sub">{E.S.mode}</span>
                : <button onClick={(e) => { e.stopPropagation(); act(() => { o.vis = o.vis === false; }); }}>
                    {o.vis === false ? '\u2715' : '\u25c9'}
                  </button>}
              <button disabled={pos === 0} title="Move forward"
                      onClick={(e) => { e.stopPropagation(); act(() => E.moveLayer(item, 1)); }}>&#9650;</button>
              <button disabled={pos === stack.length - 1} title="Move back"
                      onClick={(e) => { e.stopPropagation(); act(() => E.moveLayer(item, -1)); }}>&#9660;</button>
              {!isArt && (
                <button className="del" title="Delete layer"
                  onClick={(e) => { e.stopPropagation(); act(() => {
                    const next = st.overlays.slice();
                    next.splice(item.i, 1);
                    E.setOverlays(next);
                    if (item.i < st.artZ) E.setArtZ(st.artZ - 1);
                    E.setOvSel(-1);
                  }); }}>&#10005;</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="lfoot">
        <p className="hint" style={{ margin: 0 }}>
          The artwork sits in the stack like any other layer. Anything below it shows
          through wherever the paper is transparent.
        </p>
      </div>
    </aside>
  );
}
