import React, { useEffect, useRef, useState } from 'react';
import { E, useStore } from '../../store/useStore';

/* Singleton popover mounted once at the app root. Any Swatch calls
 * useStore().openPicker(rect, value, onChange) instead of rendering its own
 * input, matching the single #picker element the original build used. */

function hex2hsv(hex: string) {
  const c = E.hex2rgb(hex);
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}
function hsv2hex(h: number, sat: number, v: number) {
  const c = v * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  h = ((h % 360) + 360) % 360;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return E.rgb2hex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

export default function ColorPicker() {
  const picker = useStore((s) => s.picker);
  const closePicker = useStore((s) => s.closePicker);
  const boxRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState({ h: 0, s: 1, v: 1 });
  const [hexInput, setHexInput] = useState('#000000');
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useEffect(() => {
    if (!picker) return;
    const v = hex2hsv(picker.value);
    setHsv(v);
    setHexInput(picker.value.toUpperCase());
  }, [picker?.rect.left, picker?.rect.top]); // eslint-disable-line

  useEffect(() => {
    if (!picker || !boxRef.current) return;
    const bw = boxRef.current.offsetWidth || 212, bh = boxRef.current.offsetHeight || 260;
    const left = E.clamp(picker.rect.left, 8, Math.max(8, window.innerWidth - bw - 8));
    let top = picker.rect.bottom + 6;
    if (top + bh > window.innerHeight - 8) top = Math.max(8, picker.rect.top - bh - 6);
    setPos({ left, top });
  }, [picker]);

  useEffect(() => {
    if (!picker) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && boxRef.current.contains(e.target as Node)) return;
      const t = e.target as HTMLElement;
      if (t.classList && (t.classList.contains('swatch') || t.classList.contains('ink'))) return;
      closePicker();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePicker(); };
    const onResize = () => closePicker();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [picker, closePicker]);

  if (!picker) return null;

  const commit = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hex = hsv2hex(next.h, next.s, next.v);
    setHexInput(hex.toUpperCase());
    picker.onChange(hex);
  };

  const dragSV = (e: React.PointerEvent) => {
    const el = svRef.current!;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const s = E.clamp((ev.clientX - r.left) / r.width, 0, 1);
      const v = 1 - E.clamp((ev.clientY - r.top) / r.height, 0, 1);
      commit({ h: hsv.h, s, v });
    };
    move(e.nativeEvent as any);
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', move as any);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move as any);
    el.addEventListener('pointerup', up);
  };

  const dragHue = (e: React.PointerEvent) => {
    const el = hueRef.current!;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const h = E.clamp((ev.clientX - r.left) / r.width, 0, 1) * 360;
      commit({ h, s: hsv.s, v: hsv.v });
    };
    move(e.nativeEvent as any);
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', move as any);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move as any);
    el.addEventListener('pointerup', up);
  };

  const onHexInput = (v: string) => {
    setHexInput(v);
    let t = v.trim();
    if (t[0] !== '#') t = '#' + t;
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return;
    const next = hex2hsv(t);
    setHsv(next);
    picker.onChange(hsv2hex(next.h, next.s, next.v));
  };

  const eyedrop = async () => {
    const EyeDropper = (window as any).EyeDropper;
    if (!EyeDropper) { E.hooks.onToast('Your browser has no eyedropper'); return; }
    try {
      const res = await new EyeDropper().open();
      commit(hex2hsv(res.sRGBHex));
    } catch { /* cancelled */ }
  };

  const swatches = (() => {
    const seen: Record<string, boolean> = {};
    const list: string[] = [];
    [E.S.fg, E.S.fg2, E.S.bg].concat(E.layerColors as any).forEach((c: string) => {
      if (c && !seen[c.toLowerCase()]) { seen[c.toLowerCase()] = true; list.push(c); }
    });
    ['#000000', '#ffffff'].forEach((c) => { if (!seen[c]) list.push(c); });
    return list.slice(0, 16);
  })();

  const hex = hsv2hex(hsv.h, hsv.s, hsv.v);

  return (
    <div className="picker" ref={boxRef} role="dialog" aria-label="Colour picker"
         style={{ left: pos.left, top: pos.top }}>
      <div className="pk-sv" ref={svRef} onPointerDown={dragSV}
           style={{ backgroundColor: hsv2hex(hsv.h, 1, 1) }}>
        <span className="pk-dot" style={{ left: hsv.s * 100 + '%', top: (1 - hsv.v) * 100 + '%' }} />
      </div>
      <div className="pk-hue" ref={hueRef} onPointerDown={dragHue}>
        <span className="pk-bar" style={{ left: hsv.h / 360 * 100 + '%' }} />
      </div>
      <div className="pk-row">
        <span className="pk-prev" style={{ background: hex }} />
        <input type="text" value={hexInput} spellCheck={false} maxLength={7}
               aria-label="Hex value" onChange={(e) => onHexInput(e.target.value)} />
        <button type="button" className="pk-eye" title="Pick a colour from the screen" onClick={eyedrop}>&#9678;</button>
      </div>
      <div className="pk-sw">
        {swatches.map((c, i) => (
          <button key={i} type="button" style={{ background: c }} title={c}
                  onClick={() => commit(hex2hsv(c))} />
        ))}
      </div>
    </div>
  );
}
