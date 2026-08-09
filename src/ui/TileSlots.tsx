import React, { useRef, useState } from 'react';
import { E, useStore } from '../store/useStore';

export default function TileSlots() {
  useStore((s) => s.rev);
  const bump = useStore((s) => s.bump);
  const openPicker = useStore((s) => s.openPicker);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef(0);
  const [over, setOver] = useState(-1);

  const S = E.S;
  const showInk = S.tileInk === 'tile';
  const span = Math.max(S.steps, E.tileSpan());

  const touch = () => { E.invalidateTiles(); E.schedule(); bump(); };

  const fillFrom = (start: number, files: File[]) => {
    files.slice(0, 8 - start).forEach((f, k) => {
      E.loadFile(f, (im: any) => {
        E.layers[start + k] = im;
        if (!E.layerColors[start + k]) E.layerColors[start + k] = S.fg;
        touch();
      });
    });
  };

  const pick = (i: number) => { pendingSlot.current = i; fileRef.current!.click(); };

  return (
    <>
      <p className="hint" style={{ marginTop: 2 }}>
        Slot 1 is the darkest step, the last slot is the lightest. Drop several files at once
        to fill slots in order. Empty slots print nothing.
      </p>
      <div className="slots">
        {Array.from({ length: 8 }, (_, i) => {
          const layer = E.layers[i];
          const src = layer ? (layer.toDataURL ? layer.toDataURL() : layer.src) : null;
          return (
            <div key={i}
                 className={'slot' + (layer ? ' filled' : '') + (i >= span ? ' dim' : '') +
                            (layer && showInk ? ' inked' : '') + (over === i ? ' over' : '')}
                 role="button" tabIndex={0} aria-label={'Tile slot ' + (i + 1)}
                 onClick={() => pick(i)}
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } }}
                 onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                 onDragLeave={() => setOver((v) => (v === i ? -1 : v))}
                 onDrop={(e) => {
                   e.preventDefault(); e.stopPropagation(); setOver(-1);
                   const fs = Array.from(e.dataTransfer.files).filter((f) =>
                     /^image\//.test(f.type) || /\.svg$/i.test(f.name));
                   fillFrom(i, fs);
                 }}>
              <span className="num">{i + 1}</span>
              {layer ? (
                <>
                  <img src={src} alt="" />
                  <button className="clr" title="Clear slot"
                          onClick={(e) => {
                            e.stopPropagation();
                            E.layers[i] = null; E.layerColors[i] = null;
                            touch();
                          }}>x</button>
                  {showInk && (
                    <button type="button" className="ink" title={'Ink for slot ' + (i + 1)}
                            style={{ background: E.layerColors[i] || S.fg }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              openPicker({ left: r.left, right: r.right, top: r.top, bottom: r.bottom },
                                E.layerColors[i] || S.fg,
                                (hex: string) => { E.layerColors[i] = hex; touch(); });
                            }} />
                  )}
                </>
              ) : (
                <span className="plus">+</span>
              )}
            </div>
          );
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/*,.svg" hidden
             onChange={(e) => {
               const f = e.target.files?.[0];
               (e.target as HTMLInputElement).value = '';
               if (f) fillFrom(pendingSlot.current, [f]);
             }} />
    </>
  );
}
