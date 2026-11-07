import type { ExportSettings, TextLayer, TextStyle } from './types';

export const DEFAULT_FONT = 'heebo';

export const defaultStyle = (): TextStyle => ({
  fontFamily: DEFAULT_FONT,
  fontSize: 48,
  autoSize: false,
  fontWeight: 800,
  italic: false,
  underline: false,
  strike: false,
  textCase: 'none',
  letterSpacing: 0,
  lineHeight: 1.15,
  align: 'center',
  direction: 'auto',
  boxMode: 'auto',
  boxWidth: 400,
  fill: {
    type: 'solid',
    value: '#ffffff',
    gradient: {
      kind: 'linear',
      angle: 90,
      stops: [
        { offset: 0, color: '#ffe259' },
        { offset: 1, color: '#ff5c8a' }
      ]
    }
  },
  opacity: 100,
  stroke: { color: '#000000', width: 4 },
  shadow: { enabled: true, color: '#000000', opacity: 60, x: 3, y: 3, blur: 4 },
  glow: { enabled: false, color: '#ff4fd8', blur: 18, strength: 2 },
  background: { enabled: false, color: '#000000', opacity: 70, padding: 12, radius: 12 }
});

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function createLayer(width: number, height: number, partial: Partial<TextLayer> = {}, index = 1): TextLayer {
  const base = defaultStyle();
  const fontSize = Math.max(12, Math.min(96, Math.round(Math.min(width, height) / 8)));
  return {
    ...base,
    fontSize,
    boxWidth: Math.round(width * 0.9),
    id: uid(),
    name: index === 1 ? 'טקסט לדוגמה' : `טקסט ${index}`,
    visible: true,
    locked: false,
    text: 'טקסט לדוגמה',
    x: Math.round(width / 2),
    y: Math.round(height / 2),
    rotation: 0,
    anchor: 'mc',
    ...partial
  };
}

export const defaultExport = (): ExportSettings => ({
  format: 'gif',
  scale: 100,
  colors: 256,
  quality: 80,
  loop: 'source',
  loopTimes: 1,
  frameStep: 1,
  targetSizeKB: 0,
  optimize: true
});

