import React from 'react';
import { E, useStore } from '../store/useStore';
import { Section, Slider, Segmented, Toggle, Picker, Swatch, Row, Btn, Hint } from './controls';
import TileSlots from './TileSlots';

const pct = (v: any) => Math.round(v) + '%';
const two = (v: any) => Number(v).toFixed(2);
const deg = (v: any) => Number(v).toFixed(1) + '\u00b0';

export default function Panel() {
  useStore((s) => s.rev);
  const set = useStore((s) => s.set);
  const bump = useStore((s) => s.bump);
  const source = useStore((s) => s.source);
  const S = E.S;
  const st = E.getState();
  const layer = st.ovSel >= 0 ? st.overlays[st.ovSel] : null;
  const editingLayer = !!layer;

  const setLayer = (patch: any) => { Object.assign(layer, patch); E.schedule(); bump(); };

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
        <div className="modes" role="group">
          {['text', 'tiles', 'braille', 'hatch'].map((m) => (
            <button key={m} aria-pressed={S.mode === m}
              onClick={() => { S.mode = m; if (m === 'tiles' && Math.abs(S.aspect - 0.55) < 0.001) S.aspect = 1;
                               if (m !== 'tiles' && Math.abs(S.aspect - 1) < 0.001) S.aspect = 0.55;
                               E.schedule(); bump(); }}>
              {m === 'text' ? 'Glyphs' : m}
            </button>
          ))}
        </div>
      )}

      <div className="body">
        {editingLayer ? (
          <Section idx="10" title="Overlay" open>
            <Hint>Properties of the layer selected on the right.</Hint>
            <Slider label="X" value={layer.x} min={-20} max={120} step={0.5}
                    format={(v: any) => v.toFixed(1) + '%'} onChange={(v: any) => setLayer({ x: v })} />
            <Slider label="Y" value={layer.y} min={-20} max={120} step={0.5}
                    format={(v: any) => v.toFixed(1) + '%'} onChange={(v: any) => setLayer({ y: v })} />
            <Slider label="Size" value={layer.size} min={0.5} max={80} step={0.25}
                    format={(v: any) => v.toFixed(1) + '%'} onChange={(v: any) => setLayer({ size: v })} />
            <Slider label="Rotation" value={layer.rot} min={-180} max={180}
                    format={(v: any) => Math.round(v) + '\u00b0'} onChange={(v: any) => setLayer({ rot: v })} />
            <Slider label="Opacity" value={layer.op} min={0} max={100}
                    format={pct} onChange={(v: any) => setLayer({ op: v })} />
            <Picker label="Distortion" value={layer.warp} onChange={(v: any) => setLayer({ warp: v })}
              options={[
                { group: 'Baseline', items: [{ v: 'none', t: 'None' }, { v: 'wave', t: 'Wave' }, { v: 'zigzag', t: 'Zigzag' }, { v: 'arc', t: 'Arc' }] },
                { group: 'Pixel', items: [{ v: 'liquid', t: 'Liquid' }, { v: 'slice', t: 'Slice' }, { v: 'smear', t: 'Smear' }] },
              ]} />
            <Slider label="Warp amount" value={layer.amp} min={-100} max={100}
                    format={pct} onChange={(v: any) => setLayer({ amp: v })} />
            <Slider label="Chromatic split" value={layer.chroma} min={0} max={40} step={0.5}
                    format={(v: any) => v === 0 ? 'off' : v.toFixed(1) + 'px'} onChange={(v: any) => setLayer({ chroma: v })} />
            <div className="swatches">
              <Swatch label="Colour" value={layer.col} onChange={(v: any) => setLayer({ col: v })} />
            </div>
          </Section>
        ) : (
          <>
            <Section idx="01" title="Source" open>
              {source && <p className="hint">{source.name} &middot; {source.w} &times; {source.h} px</p>}
              <Row>
                <Btn ghost onClick={() => { E.setImageSource(E.makeTestChart(), 'test-chart'); bump(); }}>Test chart</Btn>
                <Btn ghost onClick={() => document.getElementById('srcFile')!.click()}>Load image</Btn>
              </Row>
              <input id="srcFile" type="file" accept="image/*" hidden onChange={(e) => {
                const f = e.target.files?.[0]; (e.target as HTMLInputElement).value = '';
                if (f) E.loadFile(f, (im: any, n: string) => { E.setImageSource(im, n); bump(); });
              }} />
            </Section>

            <Section idx="03" title="Frame" open>
              <Picker label="Output frame" value={S.frame} onChange={(v: any) => set({ frame: v })}
                options={[{ v: 'source', t: 'Source aspect' }, { v: '1:1', t: 'Square 1:1' },
                          { v: '4:5', t: 'Portrait 4:5' }, { v: '16:9', t: 'Wide 16:9' }]} />
              <Segmented label="Fit" value={S.fit} onChange={(v: any) => set({ fit: v })}
                options={[{ v: 'fill', t: 'Crop to fill' }, { v: 'fit', t: 'Fit inside' }]} />
              <Slider label="Columns" value={S.cols} min={12} max={400} onChange={(v: any) => set({ cols: v })} />
              <Segmented label="Grid" value={S.grid} onChange={(v: any) => set({ grid: v })}
                options={[{ v: 'rect', t: 'Square' }, { v: 'hex', t: 'Hex' },
                          { v: 'polar', t: 'Polar' }, { v: 'quad', t: 'Adaptive' }]} />
              <Slider label="Screen angle" value={S.angle} min={-90} max={90} step={0.5}
                      format={deg} onChange={(v: any) => set({ angle: v })} />
              <Slider label="Cell aspect" value={S.aspect} min={0.25} max={1.6} step={0.01}
                      format={two} onChange={(v: any) => set({ aspect: v })} />
              <Slider label="Cell size" value={S.cellPx} min={3} max={40}
                      format={(v: any) => v + ' px'} onChange={(v: any) => set({ cellPx: v })} />
            </Section>

            <Section idx="04" title="Tone" open>
              <Slider label="Brightness" value={S.bright} min={-100} max={100} onChange={(v: any) => set({ bright: v })} />
              <Slider label="Contrast" value={S.contrast} min={-100} max={100} onChange={(v: any) => set({ contrast: v })} />
              <Slider label="Gamma" value={S.gamma} min={0.2} max={3} step={0.01} format={two} onChange={(v: any) => set({ gamma: v })} />
              <Slider label="Inversion" value={S.invert} min={0} max={100} format={pct} onChange={(v: any) => set({ invert: v })} />
              <Slider label="Blur (cells)" value={S.blur} min={0} max={4} step={0.05} format={two} onChange={(v: any) => set({ blur: v })} />
              <Slider label="Tone steps" value={S.steps} min={2} max={8}
                      format={(v: any) => v + ' steps'} onChange={(v: any) => set({ steps: v })} />
              <Toggle label="Apply steps to glyphs too" checked={S.stepLock} onChange={(v: any) => set({ stepLock: v })} />
            </Section>

            <Section idx="05" title="Screen" open>
              <Picker label="Dither method" value={S.dither} onChange={(v: any) => set({ dither: v })}
                options={[{ v: 'none', t: 'None' }, { v: 'fs', t: 'Floyd-Steinberg' },
                          { v: 'atkinson', t: 'Atkinson' }, { v: 'jjn', t: 'Jarvis' },
                          { v: 'b4', t: 'Ordered 4x4' }, { v: 'b8', t: 'Ordered 8x8' },
                          { v: 'noise', t: 'Noise' }]} />
              <Slider label="Dither amount" value={S.damt} min={0} max={1.5} step={0.01} format={two} onChange={(v: any) => set({ damt: v })} />
              <Slider label="Edge detection" value={S.edge} min={0} max={1} step={0.01}
                      format={(v: any) => v === 0 ? 'off' : pct(v * 100)} onChange={(v: any) => set({ edge: v })} />
              <Slider label="Mark size at shadow" value={S.tmin} min={0} max={2} step={0.01} format={two} onChange={(v: any) => set({ tmin: v })} />
              <Slider label="Mark size at highlight" value={S.tmax} min={0} max={2} step={0.01} format={two} onChange={(v: any) => set({ tmax: v })} />
              <Slider label="Randomise size" value={S.sizeRnd} min={0} max={100}
                      format={(v: any) => v === 0 ? 'by tone' : pct(v)} onChange={(v: any) => set({ sizeRnd: v })} />
              <Slider label="Blob merge" value={S.merge} min={0} max={0.9} step={0.005}
                      format={(v: any) => v === 0 ? 'off' : v.toFixed(2) + ' cells'} onChange={(v: any) => set({ merge: v })} />
            </Section>

            {S.mode === 'tiles' && (
              <Section idx="07" title="Tiles" open>
                <Picker label="Built-in set" value={st.lastTileSet || 'circles'}
                  onChange={(v: any) => { E.loadTileSet(v, false); bump(); }}
                  options={[{ v: 'circles', t: 'Circles' }, { v: 'squares', t: 'Squares' },
                            { v: 'triangles', t: 'Triangles' }, { v: 'hexagons', t: 'Hexagons' },
                            { v: 'arcs', t: 'Truchet arcs' }, { v: 'dice', t: 'Dice pips' },
                            { v: 'rings', t: 'Concentric rings' }, { v: 'dots', t: 'Halftone dots' }]} />
                <Segmented label="Tile ink" value={S.tileInk} onChange={(v: any) => { set({ tileInk: v }); E.invalidateTiles(); }}
                  options={[{ v: 'auto', t: 'Auto' }, { v: 'tile', t: 'Per tile' }, { v: 'original', t: 'Original' }]} />
                <Slider label="Jitter" value={S.jitter} min={0} max={1} step={0.01} format={two} onChange={(v: any) => set({ jitter: v })} />
                <TileSlots />
              </Section>
            )}

            <Section idx="08" title="Colour" open>
              <Segmented label="Colour mode" value={S.colorMode}
                onChange={(v: any) => { set({ colorMode: v }); E.invalidateTiles(); }}
                options={[{ v: 'mono', t: 'Mono' }, { v: 'duo', t: 'Duotone' },
                          { v: 'source', t: 'Source' }, { v: 'grad', t: 'Gradient' }]} />
              <Segmented label="Paper" value={S.paperMode} onChange={(v: any) => set({ paperMode: v })}
                options={[{ v: 'solid', t: 'Solid' }, { v: 'grad', t: 'Gradient' }, { v: 'none', t: 'Transparent' }]} />
              <div className="swatches">
                <Swatch label="Ink" value={S.fg} onChange={(v: any) => { set({ fg: v }); E.invalidateTiles(); }} />
                <Swatch label="Second ink" value={S.fg2} onChange={(v: any) => { set({ fg2: v }); E.invalidateTiles(); }} />
                <Swatch label="Paper" value={S.bg} onChange={(v: any) => set({ bg: v })} />
              </div>
              <Segmented label="Separation" value={S.sep} onChange={(v: any) => set({ sep: v })}
                options={[{ v: 'off', t: 'Off' }, { v: 'cmyk', t: 'CMYK' }, { v: 'rgb', t: 'RGB' }]} />
              <Row><Btn onClick={() => { E.randomisePalette(); bump(); }}>Randomise palette</Btn></Row>
            </Section>

            <Section idx="09" title="Output">
              <Slider label="Export scale" value={S.escale} min={1} max={6}
                      format={(v: any) => v + 'x'} onChange={(v: any) => set({ escale: v })} />
              <Row>
                <Btn onClick={() => exportPNG()}>Save PNG</Btn>
                <Btn ghost onClick={() => exportSVG()}>Save SVG</Btn>
              </Row>
              <Row><Btn ghost onClick={() => { E.resetAll(); bump(); }}>Reset everything</Btn></Row>
            </Section>
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
