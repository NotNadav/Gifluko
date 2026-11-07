import type { Anchor, TextStyle } from '../model/types';

export interface MeasureCtx {
  font: string;
  direction: CanvasDirection;
  letterSpacing?: string;
  wordSpacing?: string;
  measureText(text: string): { width: number; fontBoundingBoxAscent?: number; fontBoundingBoxDescent?: number };
}

export interface LineLayout {
  text: string;
  width: number;
  x: number;
  baseline: number;
  wordSpacing: number;
}

export interface TextLayout {
  font: string;
  fontSize: number;
  letterSpacing: number;
  dir: 'rtl' | 'ltr';
  lines: LineLayout[];
  width: number;
  height: number;
  ascent: number;
  descent: number;
  lineAdvance: number;
}

export interface LayoutInput extends TextStyle {
  text: string;
}

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const STRONG_RE = /[\p{L}]/u;

export function resolveDirection(text: string, direction: TextStyle['direction']): 'rtl' | 'ltr' {
  if (direction !== 'auto') return direction;
  for (const ch of text) {
    if (RTL_RE.test(ch)) return 'rtl';
    if (STRONG_RE.test(ch)) return 'ltr';
  }
  return 'rtl';
}

export function applyCase(text: string, textCase: TextStyle['textCase']) {
  if (textCase === 'upper') return text.toLocaleUpperCase();
  if (textCase === 'lower') return text.toLocaleLowerCase();
  return text;
}

export function fontString(familyCss: string, size: number, weight: number, italic: boolean) {
  return `${italic ? 'italic ' : ''}${weight} ${Math.max(1, size)}px ${familyCss}`;
}

const segmenter: { segment(s: string): Iterable<{ segment: string }> } | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return Array.from(s);
}

export function wrapParagraph(paragraph: string, maxWidth: number, measure: (s: string) => number): string[] {
  if (!isFinite(maxWidth) || paragraph === '') return [paragraph];
  const words = paragraph.split(' ');
  const lines: string[] = [];
  let line = '';
  const pushWord = (word: string) => {
    if (measure(word) <= maxWidth || word.length <= 1) {
      line = word;
      return;
    }
    let chunk = '';
    for (const g of graphemes(word)) {
      if (chunk && measure(chunk + g) > maxWidth) {
        lines.push(chunk);
        chunk = g;
      } else chunk += g;
    }
    line = chunk;
  };
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (i === 0) {
      pushWord(word);
      continue;
    }
    const candidate = line + ' ' + word;
    if (measure(candidate) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      pushWord(word);
    }
  }
  lines.push(line);
  return lines;
}

export const wordSpacingSupported = () =>
  typeof CanvasRenderingContext2D !== 'undefined' && 'wordSpacing' in CanvasRenderingContext2D.prototype;
export const letterSpacingSupported = () =>
  typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;

export function applyFontToCtx(ctx: MeasureCtx, font: string, letterSpacingPx: number, dir: 'rtl' | 'ltr') {
  ctx.font = font;
  ctx.direction = dir;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacingPx}px`;
  if ('wordSpacing' in ctx) ctx.wordSpacing = '0px';
}

export function computeAutoSize(input: LayoutInput, familyCss: string, ctx: MeasureCtx): number {
  const text = applyCase(input.text, input.textCase);
  const dir = resolveDirection(text, input.direction);
  const probe = 100;
  applyFontToCtx(ctx, fontString(familyCss, probe, input.fontWeight, input.italic), (input.letterSpacing / 100) * probe, dir);
  let max = 0;
  for (const p of text.split('\n')) max = Math.max(max, ctx.measureText(p).width);
  if (max <= 0) return input.fontSize;
  return Math.max(4, Math.min(400, Math.floor((probe * input.boxWidth) / max)));
}

export function layoutText(input: LayoutInput, familyCss: string, ctx: MeasureCtx, justifySupported = wordSpacingSupported()): TextLayout {
  const text = applyCase(input.text, input.textCase);
  const dir = resolveDirection(text, input.direction);
  const fixed = input.boxMode === 'fixed';
  const fontSize = fixed && input.autoSize ? computeAutoSize(input, familyCss, ctx) : input.fontSize;
  const letterSpacing = (input.letterSpacing / 100) * fontSize;
  const font = fontString(familyCss, fontSize, input.fontWeight, input.italic);
  applyFontToCtx(ctx, font, letterSpacing, dir);
  const measure = (s: string) => ctx.measureText(s).width;

  const maxWidth = fixed ? Math.max(1, input.boxWidth) : Infinity;
  const raw: { text: string; last: boolean }[] = [];
  for (const p of text.split('\n')) {
    const wrapped = wrapParagraph(p, maxWidth, measure);
    wrapped.forEach((t, i) => raw.push({ text: t, last: i === wrapped.length - 1 }));
  }
  const widths = raw.map((l) => (l.text ? measure(l.text) : 0));
  const width = fixed ? maxWidth : Math.max(1, ...widths);

  const m = ctx.measureText('Hgאלק');
  const ascent = m.fontBoundingBoxAscent ?? fontSize * 0.8;
  const descent = m.fontBoundingBoxDescent ?? fontSize * 0.25;
  const lineAdvance = fontSize * input.lineHeight;
  const pad = (lineAdvance - (ascent + descent)) / 2;

  const lines: LineLayout[] = raw.map((l, i) => {
    const w = widths[i];
    let x: number;
    let wordSpacing = 0;
    let lineWidth = w;
    if (input.align === 'justify') {
      const spaces = (l.text.match(/ /g) || []).length;
      if (!l.last && spaces > 0 && justifySupported && w < width) {
        wordSpacing = (width - w) / spaces;
        lineWidth = width;
        x = 0;
      } else x = dir === 'rtl' ? width - w : 0;
    } else if (input.align === 'right') x = width - w;
    else if (input.align === 'left') x = 0;
    else x = (width - w) / 2;
    return { text: l.text, width: lineWidth, x, baseline: i * lineAdvance + pad + ascent, wordSpacing };
  });

  return {
    font,
    fontSize,
    letterSpacing,
    dir,
    lines,
    width,
    height: Math.max(lineAdvance, lines.length * lineAdvance),
    ascent,
    descent,
    lineAdvance
  };
}

export function anchorFraction(anchor: Anchor): [number, number] {
  const fx = anchor[1] === 'l' ? 0 : anchor[1] === 'c' ? 0.5 : 1;
  const fy = anchor[0] === 't' ? 0 : anchor[0] === 'm' ? 0.5 : 1;
  return [fx, fy];
}

export function boxCorners(x: number, y: number, w: number, h: number, anchor: Anchor, rotation: number, grow = 0): [number, number][] {
  const [fx, fy] = anchorFraction(anchor);
  const ax = fx * w;
  const ay = fy * h;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pts: [number, number][] = [
    [-grow, -grow],
    [w + grow, -grow],
    [w + grow, h + grow],
    [-grow, h + grow]
  ];
  return pts.map(([px, py]) => {
    const lx = px - ax;
    const ly = py - ay;
    return [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
  });
}
