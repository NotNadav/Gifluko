import type { Anchor, TextStyle } from './types';
import { defaultStyle } from './defaults';

export interface Template {
  id: string;
  name: string;
  sample: string;
  style: (w: number, h: number) => TextStyle;
  place?: { anchor: Anchor; fx: number; fy: number };
}

const base = defaultStyle;

export function edgeInset(style: Pick<TextStyle, 'stroke' | 'background'>, w: number, h: number) {
  return Math.round(Math.min(w, h) * 0.05) + style.stroke.width + (style.background.enabled ? style.background.padding : 0);
}

export function anchorPoint(anchor: Anchor, w: number, h: number, inset: number) {
  const x = anchor[1] === 'l' ? inset : anchor[1] === 'c' ? w / 2 : w - inset;
  const y = anchor[0] === 't' ? inset : anchor[0] === 'm' ? h / 2 : h - inset;
  return { x: Math.round(x), y: Math.round(y) };
}

export function templatePlacement(t: Template, style: TextStyle, w: number, h: number) {
  const anchor = t.place?.anchor ?? 'mc';
  return { anchor, ...anchorPoint(anchor, w, h, edgeInset(style, w, h)) };
}

export const TEMPLATES: Template[] = [
  {
    id: 'meme',
    name: 'מם קלאסי',
    sample: 'כשהקוד עובד',
    style: (w, h) => ({
      ...base(),
      fontFamily: 'secular-one',
      fontWeight: 400,
      fontSize: Math.max(16, Math.round(Math.min(w, h) / 7)),
      textCase: 'upper',
      lineHeight: 1.05,
      boxWidth: Math.round(w * 0.94),
      stroke: { color: '#000000', width: Math.max(2, Math.round(Math.min(w, h) / 90)) },
      shadow: { enabled: false, color: '#000000', opacity: 60, x: 2, y: 2, blur: 2 }
    }),
    place: { anchor: 'tc', fx: 0.5, fy: 0.04 }
  },
  {
    id: 'subtitle',
    name: 'כתובית סרט',
    sample: 'כתובית',
    style: (w, h) => ({
      ...base(),
      fontFamily: 'assistant',
      fontWeight: 600,
      fontSize: Math.max(12, Math.round(Math.min(w, h) / 14)),
      lineHeight: 1.2,
      boxWidth: Math.round(w * 0.86),
      fill: { ...base().fill, value: '#fff8c4' },
      stroke: { color: '#000000', width: 2 },
      shadow: { enabled: true, color: '#000000', opacity: 85, x: 0, y: 2, blur: 6 }
    }),
    place: { anchor: 'bc', fx: 0.5, fy: 0.94 }
  },
  {
    id: 'tag',
    name: 'תגית מעוגלת',
    sample: 'תגית',
    style: (w, h) => ({
      ...base(),
      fontFamily: 'rubik',
      fontWeight: 700,
      fontSize: Math.max(12, Math.round(Math.min(w, h) / 12)),
      boxMode: 'auto',
      boxWidth: Math.round(w * 0.8),
      fill: { ...base().fill, value: '#ffffff' },
      stroke: { color: '#000000', width: 0 },
      shadow: { enabled: false, color: '#000000', opacity: 50, x: 0, y: 2, blur: 4 },
      background: { enabled: true, color: '#6d4aff', opacity: 100, padding: 14, radius: 999 }
    }),
    place: { anchor: 'tr', fx: 0.95, fy: 0.06 }
  },
  {
    id: 'neon',
    name: 'כותרת ניאון',
    sample: 'ניאון',
    style: (w, h) => ({
      ...base(),
      fontFamily: 'varela-round',
      fontWeight: 400,
      fontSize: Math.max(16, Math.round(Math.min(w, h) / 8)),
      boxWidth: Math.round(w * 0.9),
      fill: { ...base().fill, value: '#ffe8fb' },
      stroke: { color: '#ff2fd0', width: 2 },
      shadow: { enabled: false, color: '#000000', opacity: 60, x: 0, y: 0, blur: 0 },
      glow: { enabled: true, color: '#ff2fd0', blur: 20, strength: 3 }
    }),
    place: { anchor: 'mc', fx: 0.5, fy: 0.5 }
  }
];
