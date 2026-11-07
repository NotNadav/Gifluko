export type Align = 'right' | 'center' | 'left' | 'justify';
export type Direction = 'auto' | 'rtl' | 'ltr';
export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
export type TextCase = 'none' | 'upper' | 'lower';
export type BoxMode = 'fixed' | 'auto';

export interface GradientStop {
  offset: number;
  color: string;
}

export interface Fill {
  type: 'solid' | 'gradient';
  value: string;
  gradient: {
    kind: 'linear' | 'radial';
    angle: number;
    stops: GradientStop[];
  };
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  autoSize: boolean;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  textCase: TextCase;
  letterSpacing: number;
  lineHeight: number;
  align: Align;
  direction: Direction;
  boxMode: BoxMode;
  boxWidth: number;
  fill: Fill;
  opacity: number;
  stroke: { color: string; width: number };
  shadow: { enabled: boolean; color: string; opacity: number; x: number; y: number; blur: number };
  glow: { enabled: boolean; color: string; blur: number; strength: number };
  background: { enabled: boolean; color: string; opacity: number; padding: number; radius: number };
}

export interface TextLayer extends TextStyle {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  text: string;
  x: number;
  y: number;
  rotation: number;
  anchor: Anchor;
}

export type ExportFormat = 'gif' | 'webp' | 'mp4' | 'png';
export type DitherMode = 'none' | 'floyd' | 'bayer4' | 'bayer8';
export type LoopMode = 'source' | 'forever' | 'count';

export interface ExportSettings {
  format: ExportFormat;
  scale: number;
  colors: number;
  quality: number;
  dither: DitherMode;
  loop: LoopMode;
  loopTimes: number;
  frameStep: number;
  targetSizeKB: number;
  optimize: boolean;
}

export interface SourceInfo {
  fileName: string;
  mime: string;
  fileSize: number;
  width: number;
  height: number;
  frameCount: number;
  delays: number[];
  loopCount: number | null;
  hasAlpha: boolean;
  kind: 'gif' | 'image' | 'animation' | 'video';
}

export interface SourceData extends SourceInfo {
  frames: ImageBitmap[];
  blob: Blob;
}

export interface Doc {
  layers: TextLayer[];
  exportSettings: ExportSettings;
}

export interface SavedStyle {
  id: string;
  name: string;
  style: TextStyle;
}

export interface CustomFont {
  family: string;
  fileName: string;
  data: ArrayBuffer;
}
