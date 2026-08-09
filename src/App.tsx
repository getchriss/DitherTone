import React from 'react';
import Panel from './ui/Panel';
import Stage from './ui/Stage';
import LayersPanel from './ui/LayersPanel';

export default function App() {
  return (
    <div className="shell">
      <Panel />
      <Stage />
      <LayersPanel />
    </div>
  );
}
