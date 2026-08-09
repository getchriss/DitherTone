import React, { useEffect, useRef } from 'react';
import { E, useStore } from '../store/useStore';

/* Direct manipulation of layers on the plate: click to select, drag the body
 * to move, drag a corner to resize, drag the top handle to rotate. Mirrors
 * the pointer math the single-file build did against its #ovUI svg. */

const SNAPS = [0, 25, 50, 75, 100];
function snapPct(v: number, shift: boolean) {
  if (shift) return v;
  for (const s of SNAPS) if (Math.abs(v - s) < 1.6) return s;
  return v;
}

type DragState =
  | { mode: 'move'; o: any; start: { x: number; y: number }; ox: number; oy: number }
  | { mode: 'rot'; o: any }
  | { mode: 'size'; o: any; corner: number };

export default function OverlayLayer() {
  useStore((s) => s.rev);
  const bump = useStore((s) => s.bump);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const guidesRef = useRef<{ v: boolean; p: number }[]>([]);

  const st = E.getState();
  const overlays = st.overlays;
  const ovSel = st.ovSel;

  const plateWH = () => ({ W: E.out.width, H: E.out.height });

  const ptFromEvent = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const d = plateWH();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left) / r.width * d.W, y: (e.clientY - r.top) / r.height * d.H };
  };

  const hitTest = (px: number, py: number) => {
    const d = plateWH();
    for (let i = overlays.length - 1; i >= 0; i--) {
      const o = overlays[i];
      if (o.vis === false) continue;
      const ext = E.ovExtent(o, d.W, d.H);
      const l = E.ovLocal(o, px, py, d.W, d.H);
      const pad = Math.max(6, Math.min(d.W, d.H) * 0.008);
      if (Math.abs(l.x) <= ext.hw + pad && Math.abs(l.y) <= ext.hh + pad) return i;
    }
    return -1;
  };

  const commit = () => { E.schedule(); bump(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st2 = E.getState();
      if (!st2.overlays[st2.ovSel]) return;
      const tag = ((e.target as HTMLElement).tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const step = e.shiftKey ? 5 : 0.5;
      const ov = st2.overlays[st2.ovSel];
      let used = true;
      if (e.key === 'ArrowLeft') ov.x -= step;
      else if (e.key === 'ArrowRight') ov.x += step;
      else if (e.key === 'ArrowUp') ov.y -= step;
      else if (e.key === 'ArrowDown') ov.y += step;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const next = st2.overlays.slice();
        next.splice(st2.ovSel, 1);
        E.setOverlays(next);
        E.setOvSel(-1);
      } else used = false;
      if (used) { e.preventDefault(); commit(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = plateWH();
    if (!d.W || d.W < 20) return;
    const pt = ptFromEvent(e);
    const target = e.target as SVGElement;
    const handle = target.getAttribute ? target.getAttribute('data-h') : null;
    const svg = svgRef.current!;

    if (handle && overlays[ovSel]) {
      const o = overlays[ovSel];
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      if (handle === 'move') dragRef.current = { mode: 'move', o, start: pt, ox: o.x, oy: o.y };
      else if (handle === 'rot') dragRef.current = { mode: 'rot', o };
      else dragRef.current = { mode: 'size', o, corner: +handle.slice(1) };
      return;
    }

    const hit = hitTest(pt.x, pt.y);
    if (hit >= 0) {
      E.setOvSel(hit);
      const o = overlays[hit];
      dragRef.current = { mode: 'move', o, start: pt, ox: o.x, oy: o.y };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
      bump();
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const d = plateWH();
    const pt = ptFromEvent(e);
    guidesRef.current = [];
    const o = drag.o;

    if (drag.mode === 'move') {
      const nx = drag.ox + (pt.x - drag.start.x) / d.W * 100;
      const ny = drag.oy + (pt.y - drag.start.y) / d.H * 100;
      const sx = snapPct(nx, e.shiftKey), sy = snapPct(ny, e.shiftKey);
      if (sx !== nx) guidesRef.current.push({ v: true, p: sx / 100 * d.W });
      if (sy !== ny) guidesRef.current.push({ v: false, p: sy / 100 * d.H });
      o.x = sx; o.y = sy;
    } else if (drag.mode === 'rot') {
      let a = Math.atan2(pt.y - o.y / 100 * d.H, pt.x - o.x / 100 * d.W) * 180 / Math.PI + 90;
      if (!e.shiftKey) a = Math.round(a / 15) * 15;
      o.rot = ((a + 180) % 360) - 180;
    } else {
      const l = E.ovLocal(o, pt.x, pt.y, d.W, d.H);
      const lx = Math.abs(l.x), ly = Math.abs(l.y);
      if (o.kind === 'text') {
        o.size = E.clamp(ly * 2 / Math.min(d.W, d.H) / 1.6 * 100 / 1.1, 0.5, 80);
      } else {
        o.size = E.clamp(lx * 2 / d.W * 100, 0.5, 80);
        o.h = E.clamp(ly * 2 / d.H * 100, 0.5, 80);
      }
    }
    commit();
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    guidesRef.current = [];
    commit();
  };

  const o = overlays[ovSel];
  const d = plateWH();
  let group: React.ReactNode = null;
  if (o) {
    const ext = E.ovExtent(o, d.W, d.H);
    const hs = Math.max(4, Math.min(d.W, d.H) * 0.012);
    const transform = `translate(${o.x / 100 * d.W} ${o.y / 100 * d.H})` +
      (o.rot ? ` rotate(${o.rot})` : '') +
      (o.skx ? ` skewX(${o.skx})` : '') + (o.sky ? ` skewY(${o.sky})` : '');
    const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    group = (
      <g transform={transform}>
        <rect className="hit" data-h="move" x={-ext.hw} y={-ext.hh} width={ext.hw * 2} height={ext.hh * 2} />
        <rect className="box" x={-ext.hw} y={-ext.hh} width={ext.hw * 2} height={ext.hh * 2} />
        {corners.map((c, i) => (
          <rect key={i} className="hnd" data-h={'r' + i}
                x={c[0] * ext.hw - hs / 2} y={c[1] * ext.hh - hs / 2} width={hs} height={hs} />
        ))}
        <line className="box" x1={0} y1={-ext.hh} x2={0} y2={-ext.hh - hs * 2.4} />
        <circle className="rot" data-h="rot" cx={0} cy={-ext.hh - hs * 2.4} r={hs * 0.62} />
      </g>
    );
  }

  return (
    <svg className={'ovui' + (o ? ' on' : '')} ref={svgRef} preserveAspectRatio="none"
         viewBox={`0 0 ${d.W || 1} ${d.H || 1}`}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove}
         onPointerUp={endDrag} onPointerCancel={endDrag}>
      {group}
    </svg>
  );
}
