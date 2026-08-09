import React, { useEffect, useRef } from 'react';
import { E, useStore, wireEngine } from '../store/useStore';
import OverlayLayer from './OverlayLayer';

export default function Stage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const stats = useStore((s) => s.stats);
  const toast = useStore((s) => s.toast);
  const S = E.S;

  useEffect(() => {
    wireEngine();
    E.attachCanvas(ref.current!);
    E.setImageSource(E.makeTestChart(), 'test-chart');
  }, []);

  return (
    <main className="stage">
      <div className="stagebar">
        <span className="lab">Plate</span><span className="val">{stats.grid}</span>
        <span className="lab">Steps</span><span className="val">{stats.steps}</span>
        <span className="lab">Cells</span><span className="val">{stats.cells}</span>
        <span className="lab">Size</span><span className="val">{stats.size}</span>
        <span className="sp" />
        <button onClick={() => E.schedule()}>Redraw</button>
      </div>
      <div className="viewport">
        <span className="reg tl" /><span className="reg tr" />
        <span className="reg bl" /><span className="reg br" />
        <div className={'plate' + (S.paperMode === 'none' ? ' checker' : '')}>
          <canvas ref={ref} width={10} height={10} />
          <OverlayLayer />
        </div>
        {stats.empty && (
          <div className="empty">
            <p>No plate loaded</p>
            <p className="sub">Drop an image, or start with the test chart.</p>
          </div>
        )}
      </div>
      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </main>
  );
}
