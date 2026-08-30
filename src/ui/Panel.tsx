import React, { useState } from 'react';
import { E, useStore } from '../store/useStore';
import { Section, Slider, Segmented, Toggle, Picker, Swatch, Row, Btn, Hint, TextField, NumberField } from './controls';
import TileSlots from './TileSlots';
import StepWedge from './StepWedge';
import TileSetPicker from './TileSetPicker';
import QuickStarts from './QuickStarts';
import CharacterTiles from './CharacterTiles';
import PatternPicker from './PatternPicker';

const pct = (v: any) => Math.round(v) + '%';
const two = (v: any) => Number(v).toFixed(2);
const deg = (v: any) => Number(v).toFixed(1) + '\u00b0';

export default function Panel() {
  const [tab, setTab] = useState<'create' | 'style' | 'settings'>('create');
  useStore((s) => s.rev);
  const set = useStore((s) => s.set);
  const bump = useStore((s) => s.bump);
  const source = useStore((s) => s.source);
  const setTxt = useStore((s) => s.setTxt);
  const S = E.S;
  const st = E.getState();
  const layer = st.ovSel >= 0 ? st.overlays[st.ovSel] : null;
  const editingLayer = !!layer;
  const shapeLayer = editingLayer && (layer.kind === 'rect' || layer.kind === 'circle' || layer.kind === 'line');
  const plateW = Math.max(1, E.out.width || 1);
  const plateH = Math.max(1, E.out.height || 1);

  const setLayer = (patch: any) => { Object.assign(layer, patch); E.schedule(); bump(); };
  const loadSourceFiles = (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (f && /^image\//.test(f.type)) E.loadFile(f, (im: any, n: string) => { E.setImageSource(im, n); bump(); });
  };

  return (
    <aside className="panel">
      <div className="masthead">
        <div className="wordmark"><h1>Dither Suite</h1><span className="v">v2</span></div>
        <p className="tagline">
          Load a picture, a video or your own type, break it into a grid, and re-print
          each cell as a glyph or an alpha tile.
        </p>
      </div>

      <div className="ctxhead">
        <span className="ico">{editingLayer ? '\u25a0' : '\u25a6'}</span>
        <span className="lbl">{editingLayer ? E.layerName(layer, st.ovSel) : 'Artwork'}</span>
        <span className="sub">{editingLayer ? layer.kind + ' layer' : S.mode + ' \u00b7 ' + st.srcKind}</span>
      </div>

      {!editingLayer && (
        <>
          <PatternPicker />
          <nav className="inspector-tabs" aria-label="Inspector">
            {(['create', 'style', 'settings'] as const).map((name) => <button type="button" key={name}
              aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}
          </nav>
        </>
      )}

      <div className="body">
        {editingLayer ? (
          <Section idx="10" title="Overlay" open>
            <Hint>Properties of the layer selected on the right.</Hint>
            {layer.kind === 'text' && <>
              <TextField label="Content" value={layer.text} multiline onChange={(v: string) => setLayer({ text: v })} />
              <TextField label="Typeface" value={layer.font} onChange={(v: string) => setLayer({ font: v })} />
            </>}
            <div className="field-pair">
              <NumberField label="X" value={Math.round(layer.x / 100 * plateW)} min={-plateW} max={plateW * 2} suffix="px" onChange={(v: number) => setLayer({ x: v / plateW * 100 })} />
              <NumberField label="Y" value={Math.round(layer.y / 100 * plateH)} min={-plateH} max={plateH * 2} suffix="px" onChange={(v: number) => setLayer({ y: v / plateH * 100 })} />
            </div>
            {shapeLayer
              ? <div className="field-pair"><NumberField label="Width" value={Math.round(layer.size / 100 * plateW)} min={1} max={plateW * 2} suffix="px"
                  onChange={(v: number) => setLayer({ size: v / plateW * 100 })} />
                  <NumberField label="Height" value={Math.round(layer.h / 100 * plateH)} min={1} max={plateH * 2} suffix="px"
                  onChange={(v: number) => setLayer({ h: v / plateH * 100 })} /></div>
              : <Slider label="Size" value={layer.size} min={0.5} max={80} step={0.25}
                  format={(v: any) => v.toFixed(1) + '%'} onChange={(v: any) => setLayer({ size: v })} />}
            <NumberField label="Rotation" value={Math.round(layer.rot)} min={-180} max={180} suffix="degrees" onChange={(v: number) => setLayer({ rot: v })} />
            {!shapeLayer && layer.kind !== 'text' && <Slider label="Height" value={layer.h} min={0.5} max={80} step={0.25} format={pct} onChange={(v: any) => setLayer({ h: v })} />}
            <div className="ctl"><span className="ctl-row"><span className="ctl-l">Align to canvas</span></span><div className="aligns">
              {[['Top left',0,0],['Top centre',50,0],['Top right',100,0],['Middle left',0,50],['Centre',50,50],['Middle right',100,50],['Bottom left',0,100],['Bottom centre',50,100],['Bottom right',100,100]].map(([name,x,y]) =>
                <button type="button" key={name as string} title={name as string} aria-label={'Align ' + name}
                  className={Math.abs(layer.x - Number(x)) < .1 && Math.abs(layer.y - Number(y)) < .1 ? 'active' : ''}
                  data-x={x} data-y={y} onClick={() => setLayer({x,y})}>
                  <span className="anchor-glyph"><i /></span>
                </button>)}</div></div>
            {layer.kind === 'text' && <>
              <Slider label="Weight" value={layer.weight} min={100} max={900} step={100} onChange={(v: any) => setLayer({ weight: v })} />
              <Slider label="Tracking" value={layer.track} min={-0.12} max={0.6} step={0.005} format={two} onChange={(v: any) => setLayer({ track: v })} />
            </>}
            <Slider label="Skew X" value={layer.skx} min={-60} max={60} format={deg} onChange={(v: any) => setLayer({ skx: v })} />
            <Slider label="Skew Y" value={layer.sky} min={-60} max={60} format={deg} onChange={(v: any) => setLayer({ sky: v })} />
            <Slider label="Opacity" value={layer.op} min={0} max={100}
                    format={pct} onChange={(v: any) => setLayer({ op: v })} />
            <details className="subgrp">
              <summary><span>Effects</span><span className="chev">&#9656;</span></summary>
              <div className="subinner">
            <Picker label="Distortion" value={layer.warp} onChange={(v: any) => setLayer({ warp: v })}
              options={[
                { group: 'Baseline', items: [{ v: 'none', t: 'None' }, { v: 'wave', t: 'Wave' }, { v: 'zigzag', t: 'Zigzag' }, { v: 'arc', t: 'Arc' }] },
                { group: 'Pixel', items: [{ v: 'liquid', t: 'Liquid' }, { v: 'slice', t: 'Slice' }, { v: 'smear', t: 'Smear' }] },
              ]} />
            <Slider label="Warp amount" value={layer.amp} min={-100} max={100}
                    format={pct} onChange={(v: any) => setLayer({ amp: v })} />
            <Slider label="Warp frequency" value={layer.freq} min={0.25} max={12} step={0.05} format={two} onChange={(v: any) => setLayer({ freq: v })} />
            <Slider label="Warp phase" value={layer.phase} min={-180} max={180} format={deg} onChange={(v: any) => setLayer({ phase: v })} />
            <Slider label="Chromatic split" value={layer.chroma} min={0} max={40} step={0.5}
                    format={(v: any) => v === 0 ? 'off' : v.toFixed(1) + 'px'} onChange={(v: any) => setLayer({ chroma: v })} />
            <Slider label="Outline weight" value={layer.stroke} min={0} max={20} step={0.25} format={two} onChange={(v: any) => setLayer({ stroke: v })} />
            <Toggle label="Use the gradient" checked={layer.grad} onChange={(v: any) => setLayer({ grad: v })} />
            <Picker label="Blend mode" value={layer.blend === true ? 'multiply' : (layer.blend || 'source-over')} onChange={(v: any) => setLayer({ blend: v })}
              options={[{v:'source-over',t:'Normal'},{v:'multiply',t:'Multiply'},{v:'screen',t:'Screen'},{v:'overlay',t:'Overlay'},{v:'difference',t:'Difference'}]} />
            <Toggle label="Drop shadow" checked={layer.shadow} onChange={(v: boolean) => setLayer({ shadow: v })} />
            {layer.shadow && <><div className="field-pair"><NumberField label="Shadow X" value={layer.shadowX || 0} min={-100} max={100} suffix="px" onChange={(v:number) => setLayer({shadowX:v})} /><NumberField label="Shadow Y" value={layer.shadowY || 0} min={-100} max={100} suffix="px" onChange={(v:number) => setLayer({shadowY:v})} /></div><Slider label="Shadow softness" value={layer.shadowBlur || 0} min={0} max={80} format={(v:any) => v + ' px'} onChange={(v:any) => setLayer({shadowBlur:v})} /><div className="swatches"><Swatch label="Shadow colour" value={layer.shadowCol || '#000000'} onChange={(v:any) => setLayer({shadowCol:v})} /></div></>}
              </div>
            </details>
            <div className="swatches">
              <Swatch label="Colour" value={layer.col} onChange={(v: any) => setLayer({ col: v })} />
            </div>
            <Row><Btn ghost onClick={() => { const copy = { ...layer, x: layer.x + 3, y: layer.y + 3 }; E.setOverlays(st.overlays.concat(copy)); E.setOvSel(st.overlays.length); E.schedule(); bump(); }}>Duplicate</Btn>
              <Btn ghost onClick={() => { const next = st.overlays.slice(); next.splice(st.ovSel, 1); E.setOverlays(next); E.setOvSel(-1); E.schedule(); bump(); }}>Delete</Btn></Row>
          </Section>
        ) : (
          <>
            {tab === 'create' && <Section idx="00" title="Quick starts" open>
              <Hint>Apply a complete look, then adjust it. Your source and layers stay in place.</Hint>
              <QuickStarts />
            </Section>}
            {tab === 'create' && <Section idx="01" title="Source" open>
              <Segmented label="Source type" value={st.srcKind === 'text' ? 'text' : 'image'} onChange={(v: string) => {
                if (v === 'text') { E.setSourceKind('text'); E.refreshTextPlate(); }
                else if (E.lastImage) E.setImageSource(E.lastImage, E.lastImageName);
                else E.setImageSource(E.makeTestChart(), 'test-chart');
                bump();
              }} options={[{ v: 'image', t: 'Image' }, { v: 'text', t: 'Type' }]} />
              {source && <p className="hint">{source.name} &middot; {source.w} &times; {source.h} px</p>}
              {st.srcKind !== 'text' ? <><div className="drop" role="button" tabIndex={0} onClick={() => document.getElementById('srcFile')!.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('srcFile')!.click(); }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('over')}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); loadSourceFiles(e.dataTransfer.files); }}>
                <div className="big">Drop an image here</div><div className="small">or click to browse</div>
              </div>
              <Row>
                <Btn ghost onClick={() => { E.setImageSource(E.makeTestChart(), 'test-chart'); bump(); }}>Test chart</Btn>
                <Btn ghost onClick={() => document.getElementById('srcFile')!.click()}>Load image</Btn>
              </Row>
              <input id="srcFile" type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.target.files?.[0]; (e.target as HTMLInputElement).value = '';
                if (f) loadSourceFiles([f]);
              }} />
              </> : <>
                <TextField label="Text" value={E.TXT.text} multiline onChange={(v: string) => setTxt({ text: v })} />
                <TextField label="Typeface" value={E.TXT.custom || E.TXT.family} onChange={(v: string) => setTxt({ custom: v })} />
                <Slider label="Weight" value={E.TXT.weight} min={100} max={900} step={100} onChange={(v: number) => setTxt({ weight: v })} />
                <Slider label="Tracking" value={E.TXT.track} min={-0.12} max={0.6} step={0.005} format={two} onChange={(v: number) => setTxt({ track: v })} />
                <Slider label="Line height" value={E.TXT.lead} min={0.6} max={2.2} step={0.01} format={two} onChange={(v: number) => setTxt({ lead: v })} />
                <Toggle label="Italic" checked={E.TXT.italic} onChange={(v: boolean) => setTxt({ italic: v })} />
              </>}
            </Section>}

            {tab === 'settings' && <Section idx="01" title="Canvas & grid" open>
              <Picker label="Output frame" value={S.frame} onChange={(v: any) => set({ frame: v })}
                options={[{ v: 'source', t: 'Source aspect' }, { v: '1:1', t: 'Square 1:1' },
                          { v: '4:5', t: 'Portrait 4:5' }, { v: '16:9', t: 'Wide 16:9' }]} />
              <Segmented label="Fit" value={S.fit} onChange={(v: any) => set({ fit: v })}
                options={[{ v: 'fill', t: 'Crop to fill' }, { v: 'fit', t: 'Fit inside' }]} />
              <Slider label="Columns" value={S.cols} min={12} max={400} onChange={(v: any) => set({ cols: v })} />
              <Toggle label="Rows follow frame" checked={S.autoRows} onChange={(v: any) => set({ autoRows: v })} />
              {!S.autoRows && <Slider label="Rows" value={S.rows} min={4} max={300} onChange={(v: any) => set({ rows: v })} />}
              {S.mode !== 'braille' && <Segmented label="Grid" value={S.grid} onChange={(v: any) => set({ grid: v })}
                options={[{ v: 'rect', t: 'Square' }, { v: 'hex', t: 'Hex' },
                          { v: 'polar', t: 'Polar' }, { v: 'quad', t: 'Adaptive' }]} />}
              {S.mode !== 'braille' && <><Slider label="Screen angle" value={S.angle} min={-90} max={90} step={0.5}
                      format={deg} onChange={(v: any) => set({ angle: v })} />
                <Toggle label="Keep marks upright" checked={S.upright} onChange={(v: any) => set({ upright: v })} /></>}
              {S.mode !== 'braille' && S.grid === 'quad' && <><Slider label="Split sensitivity" value={S.quadDetail} min={1} max={100} onChange={(v: any) => set({ quadDetail: v })} /><Slider label="Max subdivision" value={S.quadDepth} min={1} max={6} onChange={(v: any) => set({ quadDepth: v })} /></>}
              <Slider label="Cell aspect" value={S.aspect} min={0.25} max={1.6} step={0.01}
                      format={two} onChange={(v: any) => set({ aspect: v })} />
              <Slider label="Cell size" value={S.cellPx} min={3} max={40}
                      format={(v: any) => v + ' px'} onChange={(v: any) => set({ cellPx: v })} />
            </Section>}

            {tab === 'style' && <Section idx="01" title="Tone" open>
              <Slider label="Brightness" value={S.bright} min={-100} max={100} onChange={(v: any) => set({ bright: v })} />
              <Slider label="Contrast" value={S.contrast} min={-100} max={100} onChange={(v: any) => set({ contrast: v })} />
              <Slider label="Gamma" value={S.gamma} min={0.2} max={3} step={0.01} format={two} onChange={(v: any) => set({ gamma: v })} />
              <Slider label="Black point" value={S.black} min={0} max={0.9} step={0.01} format={two} onChange={(v: any) => set({ black: v })} />
              <Slider label="White point" value={S.white} min={0.1} max={1} step={0.01} format={two} onChange={(v: any) => set({ white: v })} />
              <Slider label="Inversion" value={S.invert} min={0} max={100} format={pct} onChange={(v: any) => set({ invert: v })} />
              <Slider label="Blur (cells)" value={S.blur} min={0} max={4} step={0.05} format={two} onChange={(v: any) => set({ blur: v })} />
              <Slider label="Saturation" value={S.sat} min={0} max={200} format={pct} onChange={(v: any) => set({ sat: v })} />
              <Slider label="Tone steps" value={S.steps} min={2} max={8}
                      format={(v: any) => v + ' steps'} onChange={(v: any) => set({ steps: v })} />
              {S.mode === 'text' && <Toggle label="Apply steps to glyphs too" checked={S.stepLock} onChange={(v: any) => set({ stepLock: v })} />}
              {S.mode === 'tiles' && <Toggle label="Keep this count when loading tile sets" checked={S.keepSteps} onChange={(v: any) => set({ keepSteps: v })} />}
            </Section>}

            {tab === 'create' && <Section idx="02" title="Pattern mapping">
              <Toggle label="Flip step order" checked={S.flipSteps} onChange={(v: any) => set({ flipSteps: v })} />
              <Picker label="Dither method" value={S.dither} onChange={(v: any) => set({ dither: v })}
                options={[{ v: 'none', t: 'None' }, { v: 'fs', t: 'Floyd-Steinberg' },
                          { v: 'atkinson', t: 'Atkinson' }, { v: 'jjn', t: 'Jarvis' },
                          { v: 'b4', t: 'Ordered 4x4' }, { v: 'b8', t: 'Ordered 8x8' },
                          { v: 'noise', t: 'Noise' }]} />
              <Slider label="Dither amount" value={S.damt} min={0} max={1.5} step={0.01} format={two} onChange={(v: any) => set({ damt: v })} />
              <Toggle label="Serpentine scan" checked={S.serp} onChange={(v: any) => set({ serp: v })} />
              <Slider label="Edge detection" value={S.edge} min={0} max={1} step={0.01}
                      format={(v: any) => v === 0 ? 'off' : pct(v * 100)} onChange={(v: any) => set({ edge: v })} />
              {S.mode !== 'braille' && <>
                <Slider label="Mark size at shadow" value={S.tmin} min={0} max={2} step={0.01} format={two} onChange={(v: any) => set({ tmin: v })} />
                <Slider label="Mark size at highlight" value={S.tmax} min={0} max={2} step={0.01} format={two} onChange={(v: any) => set({ tmax: v })} />
                <Slider label="Randomise size" value={S.sizeRnd} min={0} max={100}
                        format={(v: any) => v === 0 ? 'by tone' : pct(v)} onChange={(v: any) => set({ sizeRnd: v })} />
              </>}
              <Slider label="Blob merge" value={S.merge} min={0} max={0.9} step={0.005}
                      format={(v: any) => v === 0 ? 'off' : v.toFixed(2) + ' cells'} onChange={(v: any) => set({ merge: v })} />
              {S.merge > 0 && <><Slider label="Merge threshold" value={S.mergeT} min={0} max={1} step={0.01} format={two} onChange={(v: any) => set({ mergeT: v })} /><Slider label="Edge softness" value={S.mergeSoft} min={0} max={0.3} step={0.005} format={two} onChange={(v: any) => set({ mergeSoft: v })} /><Slider label="Cell wall" value={S.mergeOut} min={0} max={0.5} step={0.005} format={two} onChange={(v: any) => set({ mergeOut: v })} /></>}
            </Section>}

            {tab === 'create' && S.mode === 'text' && <Section idx="03" title="Glyphs" open>
              <StepWedge />
              <Picker label="Ramp preset" value={S.ramp} onChange={(v: any) => set({ ramp: v })} options={E.RAMPS.map((r: any) => ({ v: r[1], t: r[0] }))} />
              <TextField label="Ramp (dark to light)" className="ramp" value={S.ramp} onChange={(v: string) => set({ ramp: v })} />
              <TextField label="Typeface" value={S.font} onChange={(v: string) => set({ font: v })} />
              <Slider label="Glyph size" value={S.fscale} min={0.25} max={2} step={0.01} format={two} onChange={(v: any) => set({ fscale: v })} />
              <Slider label="Weight" value={S.fweight} min={100} max={900} step={100} onChange={(v: any) => set({ fweight: v })} />
              <Toggle label="Reverse ramp order" checked={S.reverseRamp} onChange={(v: any) => set({ reverseRamp: v })} />
            </Section>}

            {tab === 'create' && S.mode === 'braille' && <Section idx="03" title="Braille" open>
              <StepWedge />
              <Hint>Braille uses an upright 2 &times; 4 dot cell. Grid shape, rotation and typeface controls are fixed automatically.</Hint>
              <Slider label="Dot size at shadow" value={S.tmin} min={0} max={2} step={0.01} format={two} onChange={(v: any) => set({ tmin: v })} />
              <Slider label="Dot size at highlight" value={S.tmax} min={0} max={2} step={0.01} format={two} onChange={(v: any) => set({ tmax: v })} />
            </Section>}

            {tab === 'create' && S.mode === 'hatch' && <Section idx="03" title="Hatch" open>
              <Segmented label="Direction" value={S.flow} onChange={(v: any) => set({ flow: v })} options={[{v:'image',t:'Follow image'},{v:'fixed',t:'Fixed angle'}]} />
              {S.flow === 'image' && <Slider label="Flow smoothing" value={S.flowSm} min={0} max={12} format={(v: any) => v + ' cells'} onChange={(v: any) => set({ flowSm: v })} />}
              <Slider label="Stroke weight" value={S.hatchW} min={0.02} max={0.8} step={0.01} format={two} onChange={(v: any) => set({ hatchW: v })} />
              <Slider label="Stroke length" value={S.hatchL} min={0.2} max={2.5} step={0.01} format={two} onChange={(v: any) => set({ hatchL: v })} />
            </Section>}

            {tab === 'create' && S.mode === 'tiles' && (
              <Section idx="03" title="Tiles" open>
                <StepWedge />
                <TileSetPicker />
                <CharacterTiles />
                <Segmented label="Tile ink" value={S.tileInk} onChange={(v: any) => { set({ tileInk: v }); E.invalidateTiles(); }}
                  options={[{ v: 'auto', t: 'Auto' }, { v: 'tile', t: 'Per tile' }, { v: 'original', t: 'Original' }]} />
                <Slider label="Jitter" value={S.jitter} min={0} max={1} step={0.01} format={two} onChange={(v: any) => set({ jitter: v })} />
                <Slider label="Edge feather" value={S.feather} min={0} max={8} step={0.1} format={two} onChange={(v: any) => { set({ feather: v }); E.invalidateTiles(); }} />
                <Picker label="Rotation" value={S.rot} onChange={(v: any) => set({ rot: v })} options={[{v:'none',t:'Off'},{v:'edge',t:'Follow edges'},{v:'rand',t:'Random'}]} />
                <Picker label="Snap rotation" value={S.snap} onChange={(v: any) => set({ snap: v })} options={[{v:'0',t:'Off'},{v:'45',t:'45 degrees'},{v:'90',t:'90 degrees'}]} />
                <TileSlots />
              </Section>
            )}

            {tab === 'style' && <Section idx="02" title="Colour" open>
              <Segmented label="Colour mode" value={S.colorMode}
                onChange={(v: any) => { set({ colorMode: v }); E.invalidateTiles(); }}
                options={[{ v: 'mono', t: 'Mono' }, { v: 'duo', t: 'Duotone' },
                          { v: 'source', t: 'Source' }, { v: 'grad', t: 'Gradient' }]} />
              <Segmented label="Paper" value={S.paperMode} onChange={(v: any) => set({ paperMode: v })}
                options={[{ v: 'solid', t: 'Solid' }, { v: 'grad', t: 'Gradient' }, { v: 'none', t: 'Transparent' }]} />
              {(S.colorMode === 'grad' || S.paperMode === 'grad') && <div className="gradient-box">
                <div className="gradient-preview" style={{ background: `linear-gradient(${S.gradAng}deg, ${S.gc1}, ${S.gradMid ? S.gc2 + ',' : ''} ${S.gc3})` }} />
                <Segmented label="Gradient shape" value={S.gradType} onChange={(v: any) => set({ gradType: v })}
                  options={[{v:'linear',t:'Linear'},{v:'radial',t:'Radial'},{v:'conic',t:'Conic'}]} />
                {S.gradType !== 'radial' && <Slider label="Gradient angle" value={S.gradAng} min={-180} max={180} format={deg} onChange={(v: any) => set({ gradAng: v })} />}
                <div className="swatches">
                  <Swatch label="Start" value={S.gc1} onChange={(v: any) => set({ gc1: v })} />
                  {S.gradMid && <Swatch label="Middle" value={S.gc2} onChange={(v: any) => set({ gc2: v })} />}
                  <Swatch label="End" value={S.gc3} onChange={(v: any) => set({ gc3: v })} />
                </div>
                <Toggle label="Use middle colour" checked={S.gradMid} onChange={(v: any) => set({ gradMid: v })} />
              </div>}
              <div className="swatches">
                <Swatch label="Ink" value={S.fg} onChange={(v: any) => { set({ fg: v }); E.invalidateTiles(); }} />
                {S.colorMode === 'duo' && <Swatch label="Second ink" value={S.fg2} onChange={(v: any) => { set({ fg2: v }); E.invalidateTiles(); }} />}
                {S.paperMode === 'solid' && <Swatch label="Paper" value={S.bg} onChange={(v: any) => set({ bg: v })} />}
              </div>
              <Segmented label="Separation" value={S.sep} onChange={(v: any) => set({ sep: v })}
                options={[{ v: 'off', t: 'Off' }, { v: 'cmyk', t: 'CMYK' }, { v: 'rgb', t: 'RGB' }]} />
              {S.sep !== 'off' && <><Slider label="Angle spread" value={S.sepSpread} min={0} max={3} step={0.05} format={two} onChange={(v: any) => set({ sepSpread: v })} /><Slider label="Misregistration" value={S.misreg} min={0} max={2} step={0.01} format={two} onChange={(v: any) => set({ misreg: v })} /></>}
              <Picker label="Palette harmony" value={S.harmony} onChange={(v: any) => set({ harmony: v })} options={[{v:'auto',t:'Surprise me'},{v:'mono',t:'Monochrome'},{v:'analogous',t:'Analogous'},{v:'complementary',t:'Complementary'},{v:'split',t:'Split complementary'},{v:'triadic',t:'Triadic'},{v:'tetradic',t:'Tetradic'}]} />
              <Segmented label="Paper key" value={S.paperKey} onChange={(v: any) => set({ paperKey: v })} options={[{v:'auto',t:'Auto'},{v:'dark',t:'Dark'},{v:'light',t:'Light'}]} />
              <Slider label="Palette contrast" value={S.pContrast} min={2} max={12} step={.5} format={(v: any) => v.toFixed(1) + ':1'} onChange={(v: any) => set({ pContrast: v })} />
              <Row><Btn onClick={() => { E.randomisePalette(); bump(); }}>Randomise palette</Btn></Row>
            </Section>}

            {tab === 'style' && <Section idx="03" title="Print texture">
              <Slider label="Dot gain" value={S.gain} min={-50} max={100} format={pct} onChange={(v: any) => set({ gain: v })} />
              <Slider label="Ink variance" value={S.inkVar} min={0} max={100} format={pct} onChange={(v: any) => set({ inkVar: v })} />
              <Slider label="Edge bleed" value={S.bleed} min={0} max={0.5} step={0.005}
                format={(v: any) => v === 0 ? 'off' : v.toFixed(3) + ' cells'} onChange={(v: any) => set({ bleed: v })} />
              <Slider label="Paper grain" value={S.grain} min={0} max={100} format={pct} onChange={(v: any) => set({ grain: v })} />
              <Slider label="Grain size" value={S.grainSize} min={0.25} max={6} step={0.05} format={two} onChange={(v: any) => set({ grainSize: v })} />
            </Section>}

            {tab === 'settings' && <Section idx="02" title="Export" open>
              <Slider label="Export scale" value={S.escale} min={1} max={6}
                      format={(v: any) => v + 'x'} onChange={(v: any) => set({ escale: v })} />
              <Row>
                <Btn onClick={() => exportPNG()}>Save PNG</Btn>
                <Btn ghost onClick={() => exportSVG()}>Save SVG</Btn>
              </Row>
              <Row><Btn ghost onClick={() => { E.resetAll(); bump(); }}>Reset everything</Btn></Row>
            </Section>}
          </>
        )}
      </div>
    </aside>
  );
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportPNG() {
  const c = document.createElement('canvas');
  E.render(c, E.S.escale, true);
  c.toBlob((b) => b && download(b, 'plate.png'), 'image/png');
  E.render();
}
function exportSVG() {
  const svg = E.buildSVG();
  if (svg) download(new Blob([svg], { type: 'image/svg+xml' }), 'plate.svg');
}
