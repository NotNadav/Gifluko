import { useEffect, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage, Transformer } from 'react-konva';
import type Konva from 'konva';
import { beginGesture, endGesture, updateLayer, useEditor } from '../../store/editor';
import { useLayerGeoms } from '../../render/useLayouts';
import { anchorFraction } from '../../render/layout';
import { safeMargin } from '../panels/SettingsPanel';
import type { TextLayer } from '../../model/types';

const ACCENT = '#6d4aff';
const GUIDE = '#ff3d8b';
export const STAGE_PAD = 32;
const SNAPS =Array.from({ length: 24 }, (_, i) => i * 15);

interface Guides {
  v: number[];
  h: number[];
}

export function KonvaOverlay() {
  const source = useEditor((s) => s.source)!;
  const layers = useEditor((s) => s.doc.layers);
  const selectedId = useEditor((s) => s.selectedId);
  const editingId = useEditor((s) => s.editingId);
  const zoom = useEditor((s) => s.zoom);
  const showSafe = useEditor((s) => s.showSafe);
  const shiftDown = useEditor((s) => s.shiftDown);
  const geoms = useLayerGeoms();
  const layerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const activeAnchor = useRef<string | null>(null);
  const [guides, setGuides] = useState<Guides>({ v: [], h: [] });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const W = source.width;
  const H = source.height;
  const m = safeMargin(W, H);
  const selected = layers.find((l) => l.id === selectedId);

  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    const node = selected && selected.visible && !selected.locked && editingId !== selected.id ? layer.findOne(`#n-${selected.id}`) : null;
    if (tr.nodes()[0] !== node) tr.nodes(node ? [node] : []);
    else if (!tr.isTransforming()) tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  }, [selectedId, selected?.locked, selected?.visible, editingId, layers, geoms]);

  const aabb = (id: string) => {
    const g = geoms.get(id);
    if (!g) return null;
    const xs = g.corners.map((c) => c[0]);
    const ys = g.corners.map((c) => c[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };

  const onDragMove = (layer: TextLayer, node: Konva.Node) => {
    const threshold = 6 / zoom;
    const box = node.getClientRect({ relativeTo: layerRef.current!, skipStroke: true, skipShadow: true });
    const vT = [0, W / 2, W, m, W - m];
    const hT = [0, H / 2, H, m, H - m];
    for (const other of layers) {
      if (other.id === layer.id || !other.visible) continue;
      const b = aabb(other.id);
      if (!b) continue;
      vT.push(b.x0, (b.x0 + b.x1) / 2, b.x1);
      hT.push(b.y0, (b.y0 + b.y1) / 2, b.y1);
    }
    const xs = [box.x, box.x + box.width / 2, box.x + box.width];
    const ys = [box.y, box.y + box.height / 2, box.y + box.height];
    const best = (edges: number[], targets: number[]) => {
      let d = Infinity;
      let line: number | null = null;
      for (const e of edges) for (const t of targets) if (Math.abs(t - e) < Math.abs(d) && Math.abs(t - e) <= threshold) {
        d = t - e;
        line = t;
      }
      return { d: isFinite(d) ? d : 0, line };
    };
    const bx = best(xs, vT);
    const by = best(ys, hT);
    node.x(node.x() + bx.d);
    node.y(node.y() + by.d);
    setGuides({ v: bx.line != null ? [bx.line] : [], h: by.line != null ? [by.line] : [] });
    updateLayer(layer.id, { x: Math.round(node.x() * 10) / 10, y: Math.round(node.y() * 10) / 10 });
  };

  const onTransform = (layer: TextLayer, node: Konva.Node) => {
    const g = geoms.get(layer.id);
    if (!g) return;
    const sx = node.scaleX();
    const a = activeAnchor.current ?? '';
    const patch: Partial<TextLayer> = { x: Math.round(node.x() * 10) / 10, y: Math.round(node.y() * 10) / 10 };
    let rot = node.rotation() % 360;
    if (rot > 180) rot -= 360;
    if (rot < -180) rot += 360;
    patch.rotation = Math.round(rot * 10) / 10;
    if (a === 'middle-left' || a === 'middle-right') {
      patch.boxMode = 'fixed';
      patch.boxWidth = Math.max(10, Math.round(g.layout.width * sx));
    } else if (a !== 'rotater' && Math.abs(sx - 1) > 1e-4) {
      if (layer.autoSize && layer.boxMode === 'fixed') patch.boxWidth = Math.max(10, Math.round(layer.boxWidth * sx));
      else {
        patch.fontSize = Math.max(4, Math.min(400, Math.round(layer.fontSize * sx * 10) / 10));
        if (layer.boxMode === 'fixed') patch.boxWidth = Math.max(10, Math.round(layer.boxWidth * sx));
      }
    }
    node.scaleX(1);
    node.scaleY(1);
    updateLayer(layer.id, patch);
  };

  return (
    <Stage
      width={Math.round(W * zoom) + STAGE_PAD * 2}
      height={Math.round(H * zoom) + STAGE_PAD * 2}
      x={STAGE_PAD}
      y={STAGE_PAD}
      scaleX={zoom}
      scaleY={zoom}
      className="absolute"
      style={{ left: -STAGE_PAD, top: -STAGE_PAD }}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) useEditor.setState({ selectedId: null, editingId: null });
      }}
      onTouchStart={(e) => {
        if (e.target === e.target.getStage()) useEditor.setState({ selectedId: null, editingId: null });
      }}
    >
      <Layer ref={layerRef}>
        {showSafe && <Rect x={m} y={m} width={W - m * 2} height={H - m * 2} stroke={ACCENT} strokeWidth={1} dash={[6, 4]} strokeScaleEnabled={false} listening={false} opacity={0.7} />}
        {layers.map((l) => {
          if (!l.visible) return null;
          const g = geoms.get(l.id);
          if (!g) return null;
          const [fx, fy] = anchorFraction(l.anchor);
          const isSel = l.id === selectedId;
          const stroke = g.overflow ? '#f59e0b' : !isSel && hoverId === l.id ? ACCENT : undefined;
          return (
            <Rect
              key={l.id}
              id={`n-${l.id}`}
              x={l.x}
              y={l.y}
              width={g.layout.width}
              height={g.layout.height}
              offsetX={fx * g.layout.width}
              offsetY={fy * g.layout.height}
              rotation={l.rotation}
              fill="rgba(0,0,0,0.001)"
              stroke={stroke}
              strokeWidth={1}
              dash={g.overflow ? [4, 3] : undefined}
              strokeScaleEnabled={false}
              draggable={!l.locked && editingId !== l.id}
              onMouseEnter={(e) => {
                setHoverId(l.id);
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = l.locked ? 'default' : 'move';
              }}
              onMouseLeave={(e) => {
                setHoverId(null);
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = 'default';
              }}
              onMouseDown={() => useEditor.setState({ selectedId: l.id })}
              onTouchStart={() => useEditor.setState({ selectedId: l.id })}
              onDblClick={() => !l.locked && useEditor.setState({ selectedId: l.id, editingId: l.id })}
              onDblTap={() => !l.locked && useEditor.setState({ selectedId: l.id, editingId: l.id })}
              onDragStart={() => {
                beginGesture();
                useEditor.setState({ selectedId: l.id });
              }}
              onDragMove={(e) => onDragMove(l, e.target)}
              onDragEnd={() => {
                setGuides({ v: [], h: [] });
                endGesture();
              }}
              onTransformStart={() => {
                beginGesture();
                activeAnchor.current = trRef.current?.getActiveAnchor() ?? null;
              }}
              onTransform={(e) => onTransform(l, e.target)}
              onTransformEnd={() => {
                activeAnchor.current = null;
                endGesture();
              }}
            />
          );
        })}
        <Transformer
          ref={trRef}
          rotateEnabled
          flipEnabled={false}
          keepRatio
          shiftBehavior="none"
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
          rotationSnaps={shiftDown ? SNAPS : []}
          rotationSnapTolerance={7.5}
          anchorSize={9}
          anchorCornerRadius={2}
          anchorStroke={ACCENT}
          anchorFill="#fff"
          borderStroke={ACCENT}
          borderDash={[5, 3]}
          rotateAnchorOffset={22}
          ignoreStroke
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 4 ? oldBox : newBox)}
        />
        {guides.v.map((x, i) => (
          <Line key={`v${i}`} points={[x, -2000, x, H + 2000]} stroke={GUIDE} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
        ))}
        {guides.h.map((y, i) => (
          <Line key={`h${i}`} points={[-2000, y, W + 2000, y]} stroke={GUIDE} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
        ))}
      </Layer>
    </Stage>
  );
}
