import type { TextLayer } from '../model/types';
import { cssFamily } from '../fonts/registry';
import { anchorFraction, applyFontToCtx, layoutText, type TextLayout } from './layout';
import { hexToRgba } from '../lib/color';

let measureCanvas: HTMLCanvasElement | null = null;
function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d')!;
}

export function resolvedFamily(layer: Pick<TextLayer, 'fontFamily'>, missing?: Set<string>) {
  return missing?.has(layer.fontFamily) ? cssFamily('heebo') : cssFamily(layer.fontFamily);
}

export function computeLayout(layer: TextLayer, missing?: Set<string>): TextLayout {
  return layoutText(layer, resolvedFamily(layer, missing), measureCtx());
}

const scratch: { layer: HTMLCanvasElement | null; sil: HTMLCanvasElement | null } = { layer: null, sil: null };

function scratchCanvas(key: 'layer' | 'sil', w: number, h: number) {
  let c = scratch[key];
  if (!c) c = scratch[key] = document.createElement('canvas');
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.clearRect(0, 0, w, h);
  return { c, ctx };
}

function applyLayerTransform(ctx: CanvasRenderingContext2D, layer: TextLayer, layout: TextLayout) {
  const [fx, fy] = anchorFraction(layer.anchor);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.translate(-fx * layout.width, -fy * layout.height);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function decorationRects(layer: TextLayer, layout: TextLayout) {
  const rects: [number, number, number, number][] = [];
  const t = Math.max(1, layout.fontSize * 0.06);
  for (const line of layout.lines) {
    if (!line.text.trim()) continue;
    if (layer.underline) rects.push([line.x, line.baseline + layout.fontSize * 0.1, line.width, t]);
    if (layer.strike) rects.push([line.x, line.baseline - layout.fontSize * 0.3 - t / 2, line.width, t]);
  }
  return rects;
}

function setTextState(ctx: CanvasRenderingContext2D, layout: TextLayout) {
  applyFontToCtx(ctx, layout.font, layout.letterSpacing, layout.dir);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function eachLine(ctx: CanvasRenderingContext2D, layout: TextLayout, fn: (text: string, x: number, y: number) => void) {
  for (const line of layout.lines) {
    if (!line.text) continue;
    if ('wordSpacing' in ctx) ctx.wordSpacing = `${line.wordSpacing}px`;
    fn(line.text, line.x, line.baseline);
  }
  if ('wordSpacing' in ctx) ctx.wordSpacing = '0px';
}

function fillStyleFor(ctx: CanvasRenderingContext2D, layer: TextLayer, layout: TextLayout): string | CanvasGradient {
  if (layer.fill.type !== 'gradient' || layer.fill.gradient.stops.length < 2) return layer.fill.value;
  const { kind, angle, stops } = layer.fill.gradient;
  const w = layout.width;
  const h = layout.height;
  let g: CanvasGradient;
  if (kind === 'radial') {
    g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(1, Math.hypot(w, h) / 2));
  } else {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const half = Math.abs((w / 2) * cos) + Math.abs((h / 2) * sin);
    g = ctx.createLinearGradient(w / 2 - cos * half, h / 2 - sin * half, w / 2 + cos * half, h / 2 + sin * half);
  }
  [...stops].sort((a, b) => a.offset - b.offset).forEach((s) => g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
  return g;
}

function drawGlyphs(ctx: CanvasRenderingContext2D, layer: TextLayer, layout: TextLayout, fill: string | CanvasGradient, strokeColor: string) {
  setTextState(ctx, layout);
  const deco = decorationRects(layer, layout);
  if (layer.stroke.width > 0) {
    ctx.lineWidth = layer.stroke.width * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = strokeColor;
    eachLine(ctx, layout, (t, x, y) => ctx.strokeText(t, x, y));
    for (const [x, y, w, h] of deco) ctx.strokeRect(x, y, w, h);
  }
  ctx.fillStyle = fill;
  eachLine(ctx, layout, (t, x, y) => ctx.fillText(t, x, y));
  for (const [x, y, w, h] of deco) ctx.fillRect(x, y, w, h);
}

export function drawLayer(target: CanvasRenderingContext2D, layer: TextLayer, layout: TextLayout, W: number, H: number) {
  const needSil = layer.shadow.enabled || layer.glow.enabled;
  const L = scratchCanvas('layer', W, H);

  if (layer.background.enabled) {
    applyLayerTransform(L.ctx, layer, layout);
    const p = layer.background.padding;
    L.ctx.fillStyle = hexToRgba(layer.background.color, layer.background.opacity / 100);
    roundRectPath(L.ctx, -p, -p, layout.width + p * 2, layout.height + p * 2, layer.background.radius);
    L.ctx.fill();
  }

  if (needSil) {
    const S = scratchCanvas('sil', W, H);
    applyLayerTransform(S.ctx, layer, layout);
    drawGlyphs(S.ctx, layer, layout, '#000', '#000');
    const off = W * 2 + 100;
    const ctx = L.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (layer.glow.enabled && layer.glow.blur > 0) {
      ctx.shadowColor = layer.glow.color;
      ctx.shadowBlur = layer.glow.blur;
      ctx.shadowOffsetX = off;
      ctx.shadowOffsetY = 0;
      const n = Math.max(1, Math.min(5, Math.round(layer.glow.strength)));
      for (let i = 0; i < n; i++) ctx.drawImage(S.c, -off, 0);
    }
    if (layer.shadow.enabled && layer.shadow.opacity > 0) {
      ctx.shadowColor = hexToRgba(layer.shadow.color, layer.shadow.opacity / 100);
      ctx.shadowBlur = layer.shadow.blur;
      ctx.shadowOffsetX = off + layer.shadow.x;
      ctx.shadowOffsetY = layer.shadow.y;
      ctx.drawImage(S.c, -off, 0);
    }
    ctx.restore();
  }

  applyLayerTransform(L.ctx, layer, layout);
  drawGlyphs(L.ctx, layer, layout, fillStyleFor(L.ctx, layer, layout), layer.stroke.color);

  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalAlpha = Math.max(0, Math.min(1, layer.opacity / 100));
  target.drawImage(L.c, 0, 0);
  target.restore();
}

export interface OverlayOptions {
  skipId?: string | null;
  missing?: Set<string>;
}

export function renderOverlay(target: CanvasRenderingContext2D, layers: TextLayer[], W: number, H: number, opts: OverlayOptions = {}) {
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.clearRect(0, 0, W, H);
  target.restore();
  for (const layer of layers) {
    if (!layer.visible || layer.id === opts.skipId || !layer.text.trim()) continue;
    drawLayer(target, layer, computeLayout(layer, opts.missing), W, H);
  }
}

export function createOverlayCanvas(layers: TextLayer[], W: number, H: number, opts: OverlayOptions = {}) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  renderOverlay(c.getContext('2d')!, layers, W, H, opts);
  return c;
}

export function composeFrame(ctx: CanvasRenderingContext2D, frame: CanvasImageSource, overlay: CanvasImageSource, w: number, h: number, flatten?: string) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (flatten) {
    ctx.fillStyle = flatten;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(frame, 0, 0, w, h);
  ctx.drawImage(overlay, 0, 0, w, h);
  ctx.restore();
}
