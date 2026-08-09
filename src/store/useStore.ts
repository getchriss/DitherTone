import { create } from 'zustand';
import * as E from '../engine/core.js';

/* The engine owns the truth. This store mirrors just enough of it for React to
 * re-render controls, and every write goes through the engine so the pipeline
 * stays the single source of behaviour. */
type Stats = { grid: string; steps: string; cells: string; size: string; empty: boolean };

export type PickerTarget = {
  rect: { left: number; right: number; top: number; bottom: number };
  value: string;
  onChange: (hex: string) => void;
};

interface UI {
  rev: number;                       // bumped whenever engine state changes
  stats: Stats;
  toast: string;
  source: { name: string; w: number; h: number } | null;
  picker: PickerTarget | null;
  bump: () => void;
  set: (patch: Record<string, any>) => void;
  setTxt: (patch: Record<string, any>) => void;
  setM3: (patch: Record<string, any>) => void;
  select: (i: number) => void;
  openPicker: (rect: PickerTarget['rect'], value: string, onChange: (hex: string) => void) => void;
  closePicker: () => void;
}

export const useStore = create<UI>((set, get) => ({
  rev: 0,
  stats: { ...E.stats },
  toast: '',
  source: null,
  picker: null,
  bump: () => set({ rev: get().rev + 1 }),
  set: (patch) => { Object.assign(E.S, patch); E.schedule(); get().bump(); },
  setTxt: (patch) => { Object.assign(E.TXT, patch); E.refreshTextPlate?.(); E.schedule(); get().bump(); },
  setM3: (patch) => { Object.assign(E.M3, patch); E.schedule(); get().bump(); },
  select: (i) => { E.setOvSel(i); get().bump(); },
  openPicker: (rect, value, onChange) => set({ picker: { rect, value, onChange } }),
  closePicker: () => set({ picker: null }),
}));

let toastTimer: any = null;
export function wireEngine() {
  E.hooks.onFrame = (s: Stats) => useStore.setState({ stats: { ...s } });
  E.hooks.onToast = (m: string) => {
    useStore.setState({ toast: m });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => useStore.setState({ toast: '' }), 1600);
  };
  E.hooks.onSource = (i: any) => useStore.setState({ source: i });
}
export { E };
