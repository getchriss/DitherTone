# Dither Suite

React + Vite refactor of the single-file Halftone Console.

    npm install
    npm run dev       # http://localhost:5173
    npm run build     # -> dist/

## Why it is shaped like this

The render pipeline is **framework free**. `src/engine/core.js` owns the settings
object, the canvas surfaces and every pixel operation, and knows nothing about
React. The host attaches a canvas, mutates `S`, and calls `schedule()`.

That boundary is the whole point of the refactor. The original build had ~2,200
lines of hand-wired `addEventListener` code gluing 119 controls to that engine.
React deletes all of it: a control is now a `<Slider>` with a value and an
`onChange`, and the panel that shows it is a function of what is selected.

    src/
      engine/core.js      the pipeline, ported verbatim - sampling, layout,
                          tone, dither, tiles, glyphs, hatch, merge, press,
                          separation, 3D, warps, SVG export
      store/useStore.ts   thin mirror of engine state so React can re-render
      ui/controls/        Slider, Segmented, Toggle, Picker, Swatch, Section
      ui/Panel.tsx        the context-sensitive left panel
      ui/Stage.tsx        canvas host + status bar
      ui/LayersPanel.tsx  the layer stack
      styles/tokens.css   design tokens, mirroring the Figma Semantic collection

## Engine / host seams

`engine/core.js` exports a `host` object with a few callbacks. These are the
points where the engine used to reach into the DOM directly. Anything the React
layer has not implemented yet no-ops rather than throwing.

## Verified

The ported engine renders **pixel-identically** to the single-file build at
default settings (same 240x160 sample hash, 585020370).
