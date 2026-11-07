import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditor } from '../../store/editor';
import { renderOverlay } from '../../render/drawLayer';
import { ensureFont, nearestWeight } from '../../fonts/registry';
import { applyCase } from '../../render/layout';
import { rgbToHex } from '../../lib/color';
import { usePlayback } from '../../hooks/usePlayback';
import { KonvaOverlay } from './KonvaOverlay';
import { InlineEditor } from './InlineEditor';

const PAD = 32;

export function Workspace() {
  const source = useEditor((s) => s.source)!;
  const layers = useEditor((s) => s.doc.layers);
  const frame = useEditor((s) => s.frame);
  const zoom = useEditor((s) => s.zoom);
  const fit = useEditor((s) => s.fit);
  const editingId = useEditor((s) => s.editingId);
  const fontsVersion = useEditor((s) => s.fontsVersion);
  const missingFonts = useEditor((s) => s.missingFonts);
  const picking = useEditor((s) => s.picking);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);
  const W = source.width;
  const H = source.height;

  usePlayback();

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      if (!useEditor.getState().fit) return;
      const cw = el.clientWidth - PAD * 2;
      const ch = el.clientHeight - PAD * 2;
      if (cw <= 0 || ch <= 0) return;
      const z = Math.max(0.05, Math.min(3, cw / W, ch / H));
      useEditor.setState({ zoom: Math.floor(z * 1000) / 1000 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H, fit]);

  useEffect(() => {
    for (const l of layers) {
      if (!l.visible || !l.text.trim()) continue;
      const id = missingFonts.includes(l.fontFamily) ? 'heebo' : l.fontFamily;
      ensureFont(id, nearestWeight(id, l.fontWeight), l.italic, applyCase(l.text, l.textCase)).catch(() => undefined);
    }
    if (!overlayRef.current) overlayRef.current = document.createElement('canvas');
    const oc = overlayRef.current;
    if (oc.width !== W || oc.height !== H) {
      oc.width = W;
      oc.height = H;
    }
    renderOverlay(oc.getContext('2d')!, layers, W, H, { skipId: editingId, missing: new Set(missingFonts) });
    setOverlayVersion((v) => v + 1);
  }, [layers, fontsVersion, editingId, missingFonts, W, H]);

  useEffect(() => {
    const c = canvasRef.current;
    const oc = overlayRef.current;
    if (!c || !oc) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const f = source.frames[Math.min(frame, source.frames.length - 1)];
    if (f) ctx.drawImage(f, 0, 0);
    ctx.drawImage(oc, 0, 0);
  }, [frame, overlayVersion, source]);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useEditor.setState({ picking: null });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const pickAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source.frames[frame], -x, -y);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    picking?.(rgbToHex(r, g, b));
    useEditor.setState({ picking: null });
  };

  const sw = Math.round(W * zoom);
  const sh = Math.round(H * zoom);

  return (
    <div
      ref={containerRef}
      className="workspace-bg scroll-thin relative min-h-0 min-w-0 flex-1 overflow-auto"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg) useEditor.setState({ selectedId: null, editingId: null });
      }}
    >
      <div data-bg="1" className="flex min-h-full min-w-full items-center justify-center" style={{ padding: PAD, width: 'max-content', height: 'max-content', minWidth: '100%', minHeight: '100%' }}>
        <div className="checker relative shrink-0 shadow-[0_2px_16px_rgba(30,20,60,0.18)]" style={{ width: sw, height: sh }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="absolute inset-0"
            style={{ width: sw, height: sh, imageRendering: zoom >= 2 ? 'pixelated' : 'auto' }}
            role="img"
            aria-label="תצוגה מקדימה של הגיף עם הטקסט"
          />
          <KonvaOverlay />
          {editingId && <InlineEditor key={editingId} id={editingId} />}
          {picking && (
            <div className="absolute inset-0 z-20 cursor-crosshair" onClick={pickAt} role="button" aria-label="לחצו על נקודה בגיף לדגימת צבע" />
          )}
        </div>
      </div>
      {picking && (
        <div className="pointer-events-none sticky bottom-3 z-30 mx-auto w-fit rounded-full bg-ink px-4 py-1.5 text-xs text-white shadow-lg">
          לחצו על נקודה בגיף כדי לדגום צבע · Esc לביטול
        </div>
      )}
    </div>
  );
}
