import React, { useRef } from 'react';
import { useStore } from '../../store/useStore';

/* One declarative control per interaction type. These replace the ~2,200 lines
 * of addEventListener wiring the single-file build needed. */

export function Section({ idx, title, open, hidden, children }: any) {
  if (hidden) return null;
  return (
    <details className="grp" open={open}>
      <summary>
        <span className="idx">{idx}</span>
        <span className="ttl">{title}</span>
        <span className="chev">&#9656;</span>
      </summary>
      <div className="inner">{children}</div>
    </details>
  );
}

export function Slider({ label, value, min, max, step = 1, format, onChange }: any) {
  return (
    <label className="ctl">
      <span className="ctl-row">
        <span className="ctl-l">{label}</span>
        <span className="ctl-v">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Segmented({ label, value, options, onChange }: any) {
  return (
    <label className="ctl">
      {label && <span className="ctl-row"><span className="ctl-l">{label}</span></span>}
      <div className="seg" role="group">
        {options.map((o: any) => (
          <button key={o.v} type="button" aria-pressed={value === o.v}
                  onClick={() => onChange(o.v)}>{o.t}</button>
        ))}
      </div>
    </label>
  );
}

export function Toggle({ label, checked, onChange }: any) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Picker({ label, value, options, onChange }: any) {
  return (
    <label className="ctl">
      {label && <span className="ctl-row"><span className="ctl-l">{label}</span></span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o: any) =>
          o.group
            ? <optgroup key={o.group} label={o.group}>
                {o.items.map((x: any) => <option key={x.v} value={x.v}>{x.t}</option>)}
              </optgroup>
            : <option key={o.v} value={o.v}>{o.t}</option>
        )}
      </select>
    </label>
  );
}

export function TextField({ label, value, onChange, multiline, placeholder, className = '' }: any) {
  const field = multiline
    ? <textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    : <input type="text" className={className} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
  return <label className="ctl"><span className="ctl-row"><span className="ctl-l">{label}</span></span>{field}</label>;
}

export function NumberField({ label, value, min = 1, max, step = 1, suffix, onChange }: any) {
  return (
    <label className="ctl">
      <span className="ctl-row"><span className="ctl-l">{label}</span>{suffix && <span className="ctl-v">{suffix}</span>}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }} />
    </label>
  );
}

export function Swatch({ label, value, onChange }: any) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const openPicker = useStore((s) => s.openPicker);
  return (
    <div className="sw">
      <label>{label}</label>
      <button type="button" ref={btnRef} className="swatch" aria-label="Choose colour"
              style={{ background: value }}
              onClick={() => {
                const r = btnRef.current!.getBoundingClientRect();
                openPicker({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }, value, onChange);
              }} />
    </div>
  );
}

export function Row({ children }: any) { return <div className="btn-row">{children}</div>; }
export function Btn({ ghost, onClick, children, ...rest }: any) {
  return <button className={'btn' + (ghost ? ' ghost' : '')} onClick={onClick} {...rest}>{children}</button>;
}
export function Hint({ children }: any) { return <p className="hint">{children}</p>; }
