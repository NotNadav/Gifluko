import { useEffect, useRef } from 'react';
import { updateLayer, useEditor } from '../../store/editor';
import { useLayerGeoms } from '../../render/useLayouts';
import { anchorFraction } from '../../render/layout';
import { resolvedFamily } from '../../render/drawLayer';

export function InlineEditor({ id }: { id: string }) {
  const layer = useEditor((s) => s.doc.layers.find((l) => l.id === id));
  const zoom = useEditor((s) => s.zoom);
  const missing = useEditor((s) => s.missingFonts);
  const geoms = useLayerGeoms();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  if (!layer) return null;
  const g = geoms.get(id);
  if (!g) return null;
  const { layout } = g;
  const [fx, fy] = anchorFraction(layer.anchor);
  const w = Math.max(layout.width, layout.fontSize) * zoom;
  const h = layout.height * zoom;
  const color = layer.fill.type === 'solid' ? layer.fill.value : layer.fill.gradient.stops[0]?.color ?? '#fff';
  const exit = () => useEditor.setState({ editingId: null });

  return (
    <textarea
      ref={ref}
      aria-label="עריכת טקסט"
      value={layer.text}
      spellCheck={false}
      dir={layout.dir}
      onChange={(e) => updateLayer(id, { text: e.target.value }, `text:${id}`)}
      onBlur={exit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          exit();
        }
      }}
      className="absolute z-10 m-0 resize-none overflow-hidden border-0 bg-black/30 p-0 outline outline-2 outline-accent"
      style={{
        left: (layer.x - fx * layout.width) * zoom,
        top: (layer.y - fy * layout.height) * zoom,
        width: w + (layer.boxMode === 'auto' ? layout.fontSize * zoom : 0),
        height: h,
        transformOrigin: `${fx * 100}% ${fy * 100}%`,
        transform: `rotate(${layer.rotation}deg)`,
        fontFamily: resolvedFamily(layer, new Set(missing)),
        fontSize: layout.fontSize * zoom,
        fontWeight: layer.fontWeight,
        fontStyle: layer.italic ? 'italic' : 'normal',
        lineHeight: `${layout.lineAdvance * zoom}px`,
        letterSpacing: `${layout.letterSpacing * zoom}px`,
        textAlign: layer.align,
        textTransform: layer.textCase === 'upper' ? 'uppercase' : layer.textCase === 'lower' ? 'lowercase' : 'none',
        whiteSpace: layer.boxMode === 'auto' ? 'pre' : 'pre-wrap',
        color,
        caretColor: '#ff3d8b',
        WebkitTextStroke: layer.stroke.width > 0 ? `${Math.min(2, layer.stroke.width * zoom * 0.5)}px ${layer.stroke.color}` : undefined
      }}
    />
  );
}
