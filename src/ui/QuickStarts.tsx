import React from 'react';
import { E, useStore } from '../store/useStore';

const RECIPES = [
  { name: 'Terminal', note: 'Crisp glyph portrait', mode: 'text', patch: { cols: 96, aspect: .55, steps: 7, dither: 'atkinson', damt: .9, ramp: ' .:-=+*#%@', colorMode: 'mono', fg: '#a7ff83', bg: '#07110a', paperMode: 'solid', grain: 5, bleed: 0 } },
  { name: 'Riso dots', note: 'Loose two-ink print', mode: 'tiles', tiles: 'circles', patch: { cols: 68, aspect: 1, steps: 4, dither: 'b4', damt: .8, colorMode: 'duo', fg: '#f04e37', fg2: '#1846a3', bg: '#efe3c7', paperMode: 'solid', jitter: .12, rot: 'rand', snap: '45', grain: 18, inkVar: 12, bleed: .16 } },
  { name: 'Neon cells', note: 'Braille colour field', mode: 'braille', patch: { cols: 88, aspect: .55, steps: 8, dither: 'b8', damt: 1, colorMode: 'grad', gc1: '#6d28d9', gc2: '#06b6d4', gc3: '#facc15', gradType: 'linear', gradAng: 35, bg: '#080913', paperMode: 'solid', grain: 4 } },
  { name: 'Contour', note: 'Flowing line study', mode: 'hatch', patch: { cols: 105, aspect: .8, steps: 6, dither: 'none', colorMode: 'mono', fg: '#17251d', bg: '#d8d2bb', paperMode: 'solid', flow: 'image', flowSm: 6, hatchW: .1, hatchL: 1.7, edge: .18, grain: 10 } },
] as const;

export default function QuickStarts() {
  const bump = useStore((s) => s.bump);
  const apply = (recipe: typeof RECIPES[number]) => {
    // A recipe must be deterministic. Reset render settings first so a heavy
    // press effect or separation from the previous look cannot blank the next.
    Object.assign(E.S, E.DEF, recipe.patch, { mode: recipe.mode });
    if ('tiles' in recipe && recipe.tiles) {
      E.setLayers(new Array(8).fill(null));
      E.setLayerColors(new Array(8).fill(null));
      E.setLastTileSet(null);
      E.loadTileSet(recipe.tiles, false);
    }
    E.invalidateTiles();
    E.schedule();
    E.hooks.onToast(recipe.name + ' look applied');
    bump();
  };
  return <div className="recipes" aria-label="Quick start looks">
    {RECIPES.map((r) => <button type="button" key={r.name} onClick={() => apply(r)}>
      <span className={'recipe-chip ' + r.mode} />
      <span><b>{r.name}</b><small>{r.note}</small></span>
    </button>)}
  </div>;
}
