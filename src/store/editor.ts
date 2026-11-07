import { create } from 'zustand';
import type { CustomFont, Doc, ExportSettings, SourceData, TextLayer } from '../model/types';
import { createLayer, defaultExport, uid } from '../model/defaults';

export interface Toast {
  id: string;
  kind: 'info' | 'warn' | 'error';
  text: string;
  action?: { label: string; run: () => void };
}

export interface LoadingState {
  label: string;
  progress: number;
}

interface EditorState {
  source: SourceData | null;
  projectId: string | null;
  doc: Doc;
  past: Doc[];
  future: Doc[];
  lastKey: string | null;
  lastTime: number;
  gesture: boolean;
  selectedId: string | null;
  editingId: string | null;
  frame: number;
  playing: boolean;
  zoom: number;
  fit: boolean;
  showSafe: boolean;
  fontsVersion: number;
  missingFonts: string[];
  customFonts: CustomFont[];
  picking: ((hex: string) => void) | null;
  exportOpen: boolean;
  loading: LoadingState | null;
  toasts: Toast[];
  mobilePanel: 'settings' | 'layers' | null;
  shiftDown: boolean;
}

const emptyDoc = (): Doc => ({ layers: [], exportSettings: defaultExport() });

export const useEditor = create<EditorState>(() => ({
  source: null,
  projectId: null,
  doc: emptyDoc(),
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  gesture: false,
  selectedId: null,
  editingId: null,
  frame: 0,
  playing: true,
  zoom: 1,
  fit: true,
  showSafe: false,
  fontsVersion: 0,
  missingFonts: [],
  customFonts: [],
  picking: null,
  exportOpen: false,
  loading: null,
  toasts: [],
  mobilePanel: null,
  shiftDown: false
}));

const get = useEditor.getState;
const set = useEditor.setState;

export function commit(mutate: (doc: Doc) => void, key?: string) {
  const s = get();
  const next = structuredClone(s.doc);
  mutate(next);
  const now = Date.now();
  if (s.gesture) {
    set({ doc: next });
    return;
  }
  const merge = key != null && key === s.lastKey && now - s.lastTime < 1200;
  set({
    doc: next,
    past: merge ? s.past : [...s.past, s.doc],
    future: [],
    lastKey: key ?? null,
    lastTime: now
  });
}

export function beginGesture() {
  const s = get();
  if (s.gesture) return;
  set({ gesture: true, past: [...s.past, s.doc], future: [], lastKey: null });
}

export function endGesture() {
  const s = get();
  if (!s.gesture) return;
  const prev = s.past[s.past.length - 1];
  if (prev && JSON.stringify(prev) === JSON.stringify(s.doc)) set({ gesture: false, past: s.past.slice(0, -1) });
  else set({ gesture: false });
}

function fixSelection(doc: Doc) {
  const sel = get().selectedId;
  return sel && !doc.layers.some((l) => l.id === sel) ? null : sel;
}

export function undo() {
  const s = get();
  if (!s.past.length) return;
  const prev = s.past[s.past.length - 1];
  set({ doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future], lastKey: null, editingId: null });
  set({ selectedId: fixSelection(prev) });
}

export function redo() {
  const s = get();
  if (!s.future.length) return;
  const next = s.future[0];
  set({ doc: next, past: [...s.past, s.doc], future: s.future.slice(1), lastKey: null, editingId: null });
  set({ selectedId: fixSelection(next) });
}

export function setSource(source: SourceData, doc: Doc | null, projectId: string) {
  const old = get().source;
  if (old && old !== source) old.frames.forEach((f) => f.close?.());
  let d = doc;
  let selectedId: string | null = null;
  if (!d) {
    const layer = createLayer(source.width, source.height);
    d = { layers: [layer], exportSettings: defaultExport() };
    selectedId = layer.id;
  }
  set({
    source,
    projectId,
    doc: d,
    past: [],
    future: [],
    lastKey: null,
    selectedId,
    editingId: null,
    frame: 0,
    playing: source.frameCount > 1,
    fit: true
  });
}

export function closeProject() {
  const old = get().source;
  old?.frames.forEach((f) => f.close?.());
  set({ source: null, projectId: null, doc: emptyDoc(), past: [], future: [], selectedId: null, editingId: null, frame: 0, missingFonts: [] });
}

export function selectedLayer(): TextLayer | undefined {
  const s = get();
  return s.doc.layers.find((l) => l.id === s.selectedId);
}

export function updateLayer(id: string, patch: Partial<TextLayer> | ((l: TextLayer) => void), key?: string) {
  commit((doc) => {
    const l = doc.layers.find((x) => x.id === id);
    if (!l) return;
    if (typeof patch === 'function') patch(l);
    else Object.assign(l, patch);
  }, key ?? `layer:${id}:${typeof patch === 'function' ? 'fn' : Object.keys(patch).join(',')}`);
}

export function updateExport(patch: Partial<ExportSettings>) {
  commit((doc) => Object.assign(doc.exportSettings, patch), `export:${Object.keys(patch).join(',')}`);
}

export function addLayer(partial: Partial<TextLayer> = {}) {
  const s = get();
  if (!s.source) return;
  const layer = createLayer(s.source.width, s.source.height, partial, s.doc.layers.length + 1);
  if (!partial.name && partial.text) layer.name = partial.text.split('\n')[0].slice(0, 24) || layer.name;
  else if (!partial.name) layer.name = `טקסט ${s.doc.layers.length + 1}`;
  if (!partial.y && s.doc.layers.length) {
    const offset = (s.doc.layers.length % 5) * Math.round(s.source.height * 0.06);
    layer.y = Math.round(Math.min(s.source.height * 0.9, s.source.height / 2 + offset));
  }
  commit((doc) => doc.layers.push(layer));
  set({ selectedId: layer.id });
  return layer;
}

export function deleteLayer(id: string) {
  const s = get();
  const idx = s.doc.layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  commit((doc) => doc.layers.splice(idx, 1));
  const layers = get().doc.layers;
  set({ selectedId: layers[Math.min(idx, layers.length - 1)]?.id ?? null, editingId: null });
}

export function duplicateLayer(id: string) {
  const s = get();
  const idx = s.doc.layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const copy: TextLayer = { ...structuredClone(s.doc.layers[idx]), id: uid(), name: `${s.doc.layers[idx].name} (עותק)`, locked: false };
  copy.x += 12;
  copy.y += 12;
  commit((doc) => doc.layers.splice(idx + 1, 0, copy));
  set({ selectedId: copy.id });
}

export function reorderLayers(fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return;
  commit((doc) => {
    const [l] = doc.layers.splice(fromIndex, 1);
    doc.layers.splice(toIndex, 0, l);
  });
}

let toastSeq = 0;
export function toast(text: string, kind: Toast['kind'] = 'info', action?: Toast['action'], ttl = 6000) {
  const id = `t${++toastSeq}`;
  set((s) => ({ toasts: [...s.toasts.filter((t) => t.text !== text), { id, kind, text, action }] }));
  if (ttl > 0) setTimeout(() => dismissToast(id), ttl);
  return id;
}

export function dismissToast(id: string) {
  set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function bumpFonts() {
  set((s) => ({ fontsVersion: s.fontsVersion + 1 }));
}

export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];

export function zoomBy(dir: 1 | -1) {
  const z = get().zoom;
  const next = dir > 0 ? ZOOM_STEPS.find((s) => s > z + 0.001) ?? z : [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001) ?? z;
  set({ zoom: next, fit: false });
}
