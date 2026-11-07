import { useMemo } from 'react';
import { useEditor } from '../store/editor';
import { computeLayout } from './drawLayer';
import { boxCorners, type TextLayout } from './layout';
import type { TextLayer } from '../model/types';

export interface LayerGeom {
  layout: TextLayout;
  corners: [number, number][];
  overflow: boolean;
}

export function layerGeom(layer: TextLayer, W: number, H: number, missing?: Set<string>): LayerGeom {
  const layout = computeLayout(layer, missing);
  const grow = layer.stroke.width + (layer.background.enabled ? layer.background.padding : 0);
  const corners = boxCorners(layer.x, layer.y, layout.width, layout.height, layer.anchor, layer.rotation, grow);
  const overflow = !!layer.text.trim() && corners.some(([x, y]) => x < -0.5 || y < -0.5 || x > W + 0.5 || y > H + 0.5);
  return { layout, corners, overflow };
}

export function useLayerGeoms(): Map<string, LayerGeom> {
  const layers = useEditor((s) => s.doc.layers);
  const fontsVersion = useEditor((s) => s.fontsVersion);
  const missingList = useEditor((s) => s.missingFonts);
  const W = useEditor((s) => s.source?.width ?? 0);
  const H = useEditor((s) => s.source?.height ?? 0);
  return useMemo(() => {
    const missing = new Set(missingList);
    const m = new Map<string, LayerGeom>();
    for (const l of layers) m.set(l.id, layerGeom(l, W, H, missing));
    return m;
  }, [layers, fontsVersion, missingList, W, H]);
}
