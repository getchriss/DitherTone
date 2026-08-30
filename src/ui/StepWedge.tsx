import React from 'react';
import { E, useStore } from '../store/useStore';

/* The strip of tone steps above the panel body - shadow to highlight, shown
 * as whatever the current mode actually prints (glyph, tile, braille dot, or
 * plain swatch for hatch). Mirrors the single-file build's #wedge. */
export default function StepWedge() {
  useStore((s) => s.rev);
  const S = E.S;
  const L = E.levelCount();
  const chars = E.rampChars();
  const fg = E.hex2rgb(S.fg), fg2 = E.hex2rgb(S.fg2);
  const tiles = S.mode === 'tiles' ? E.resolveTiles(L) : null;

  return (
    <details className="wedge-wrap">
      <summary className="wedge-head">
        <span className="ctl-l">Step wedge</span>
        <span className="ctl-v">{L + (L === 1 ? ' step' : ' steps')}</span>
        <span className="wedge-chev">&#9656;</span>
      </summary>
      <div className="wedge">
        {Array.from({ length: L }, (_, i) => {
          const col = S.colorMode === 'duo' ? E.rgbcss(E.mix(fg, fg2, L > 1 ? i / (L - 1) : 0)) : E.rgbcss(fg);
          let inner: React.ReactNode = null;
          if (S.mode === 'tiles') {
            const art = tiles!.art[i];
            if (art) {
              const src = art.toDataURL ? art.toDataURL() : art.src;
              inner = <img src={src} alt="" />;
            }
          } else if (S.mode === 'braille') {
            inner = <span className="g" style={{ color: col }}>{i === 0 ? '⠀' : '⣿'}</span>;
          } else {
            const ch = chars[i];
            inner = <span className="g" style={{ color: col, opacity: ch === ' ' ? 0.22 : 1 }}>
              {ch === ' ' ? '·' : ch}
            </span>;
          }
          return (
            <div key={i} className="step" style={{ background: S.bg }}>
              <span className="n">{i + 1}</span>
              {inner}
            </div>
          );
        })}
      </div>
    </details>
  );
}
