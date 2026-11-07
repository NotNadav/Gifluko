import { useEffect } from 'react';
import { addLayer, beginGesture, deleteLayer, duplicateLayer, endGesture, redo, undo, updateLayer, useEditor, zoomBy } from '../store/editor';
import { openFile, pickFile } from '../app/actions';
import { ACCEPT } from '../decode/load';

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

let nudgeTimer: ReturnType<typeof setTimeout> | null = null;

export function useShortcuts() {
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const s = useEditor.getState();
      if (e.key === 'Shift') {
        if (!s.shiftDown) useEditor.setState({ shiftDown: true });
      }
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      if (mod && (key === 'o' || code === 'KeyO')) {
        e.preventDefault();
        const f = await pickFile(`${ACCEPT},.json`);
        if (f) await openFile(f);
        return;
      }
      if (mod && e.shiftKey && (key === 'e' || code === 'KeyE')) {
        e.preventDefault();
        if (s.source) useEditor.setState({ exportOpen: true });
        return;
      }
      if (isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (!s.source) return;

      if (mod && (key === 'z' || code === 'KeyZ')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (key === 'y' || code === 'KeyY')) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && (key === 'd' || code === 'KeyD')) {
        e.preventDefault();
        if (s.selectedId) duplicateLayer(s.selectedId);
        return;
      }
      if (mod || e.altKey) return;

      if (code === 'KeyT' || key === 't' || key === 'א') {
        e.preventDefault();
        addLayer();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        if (s.selectedId) {
          e.preventDefault();
          deleteLayer(s.selectedId);
        }
        return;
      }
      if (key === ' ' || code === 'Space') {
        e.preventDefault();
        useEditor.setState({ playing: !s.playing });
        return;
      }
      if (key === '+' || key === '=' || code === 'NumpadAdd') {
        e.preventDefault();
        zoomBy(1);
        return;
      }
      if (key === '-' || code === 'NumpadSubtract') {
        e.preventDefault();
        zoomBy(-1);
        return;
      }
      if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
        e.preventDefault();
        useEditor.setState({ fit: true });
        return;
      }
      if (key === 'escape') {
        useEditor.setState({ selectedId: null, editingId: null, picking: null });
        return;
      }
      if (key === 'enter' && s.selectedId) {
        const l = s.doc.layers.find((x) => x.id === s.selectedId);
        if (l && !l.locked) {
          e.preventDefault();
          useEditor.setState({ editingId: l.id });
        }
        return;
      }
      if (key.startsWith('arrow') && s.selectedId) {
        const l = s.doc.layers.find((x) => x.id === s.selectedId);
        if (!l || l.locked) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
        beginGesture();
        updateLayer(l.id, { x: l.x + dx, y: l.y + dy });
        if (nudgeTimer) clearTimeout(nudgeTimer);
        nudgeTimer = setTimeout(() => endGesture(), 500);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') useEditor.setState({ shiftDown: false });
    };
    const onBlur = () => useEditor.setState({ shiftDown: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
