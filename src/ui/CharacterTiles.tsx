import React, { useState } from 'react';
import { E, useStore } from '../store/useStore';
import { Btn, Hint, Row, TextField } from './controls';

export default function CharacterTiles() {
  const [value, setValue] = useState('●◉○·');
  const bump = useStore((s) => s.bump);
  const count = E.splitGraphemes(value).length;
  const apply = () => {
    const tiles = E.makeEmojiTiles(value);
    if (!tiles) { E.hooks.onToast('Type some characters first'); return; }
    const layers = new Array(8).fill(null);
    const colours = E.layerColors.slice();
    tiles.forEach((tile: any, i: number) => { layers[i] = tile; if (!colours[i]) colours[i] = E.S.fg; });
    E.setLayers(layers);
    E.setLayerColors(colours);
    E.setLastTileSet(null);
    if (!E.S.keepSteps) E.S.steps = tiles.length;
    E.invalidateTiles(); E.schedule(); bump();
    E.hooks.onToast(tiles.length + ' character tiles loaded');
  };
  return <div className="character-tiles">
    <TextField label={`Characters as tiles · ${count}/8`} value={value} onChange={setValue} placeholder="● ◉ ○ · or emoji" />
    <Row><Btn ghost onClick={apply}>Use as pattern</Btn></Row>
    <Hint>Each character becomes a tone step, darkest first. Try symbols, dingbats, letters or emoji.</Hint>
  </div>;
}
