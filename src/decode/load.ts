import type { SourceData } from '../model/types';
import { decodeGif } from './gif';
import { bitmapsHaveAlpha, canDecodeType, decodeWithImageDecoder } from './imageDecoder';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MANY_FRAMES = 500;
export const SUPPORTED_LABEL = 'GIF, WebP, APNG, PNG, JPG, MP4, WebM, MOV';
export const ACCEPT = '.gif,.webp,.png,.apng,.jpg,.jpeg,.mp4,.webm,.mov,.m4v,image/gif,image/webp,image/png,image/apng,image/jpeg,video/mp4,video/webm,video/quicktime';

export class LoadError extends Error {
  constructor(public code: 'bad-file' | 'unsupported' | 'unsupported-browser-format' | 'too-big') {
    super(code);
  }
}

async function sniff(buf: ArrayBuffer, name: string, mime: string): Promise<'gif' | 'png' | 'webp' | 'jpeg' | 'video' | null> {
  const b = new Uint8Array(buf.slice(0, 16));
  const str = (o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
  if (str(0, 3) === 'GIF') return 'gif';
  if (b[0] === 0x89 && str(1, 3) === 'PNG') return 'png';
  if (str(0, 4) === 'RIFF' && str(8, 4) === 'WEBP') return 'webp';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (str(4, 4) === 'ftyp' || (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)) return 'video';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(name)) return 'video';
  return null;
}

async function decodeStatic(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  return { frames: [bmp], delays: [100], width: bmp.width, height: bmp.height, loopCount: null as number | null };
}

export async function loadSource(file: Blob, fileName: string, onProgress?: (p: number) => void): Promise<SourceData> {
  if (file.size > MAX_FILE_BYTES) throw new LoadError('too-big');
  const buf = await file.arrayBuffer();
  const kind = await sniff(buf, fileName, file.type);
  if (!kind) throw new LoadError('unsupported');
  try {
    let res: { frames: ImageBitmap[]; delays: number[]; width: number; height: number; loopCount: number | null; hasAlpha?: boolean };
    let mime: string;
    let sourceKind: SourceData['kind'];
    if (kind === 'gif') {
      res = await decodeGif(buf, onProgress);
      mime = 'image/gif';
      sourceKind = 'gif';
    } else if (kind === 'video') {
      const { decodeVideo } = await import('./video');
      res = await decodeVideo(buf, fileName, onProgress);
      mime = file.type || 'video/mp4';
      sourceKind = 'video';
    } else {
      mime = kind === 'png' ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/jpeg';
      if (kind !== 'jpeg' && (await canDecodeType(mime))) {
        res = await decodeWithImageDecoder(buf, mime, onProgress);
      } else if (kind === 'webp' && (await isAnimatedWebp(buf))) {
        throw new LoadError('unsupported-browser-format');
      } else {
        res = await decodeStatic(new Blob([buf], { type: mime }));
      }
      sourceKind = res.frames.length > 1 ? 'animation' : 'image';
    }
    const hasAlpha = res.hasAlpha ?? (kind === 'jpeg' || kind === 'video' ? false : bitmapsHaveAlpha(res.frames));
    return {
      fileName,
      mime,
      fileSize: file.size,
      width: res.width,
      height: res.height,
      frameCount: res.frames.length,
      delays: res.delays,
      loopCount: res.loopCount,
      hasAlpha,
      kind: sourceKind,
      frames: res.frames,
      blob: file instanceof File ? new Blob([buf], { type: file.type || mime }) : file
    };
  } catch (e) {
    if (e instanceof LoadError) throw e;
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'unsupported-browser-format') throw new LoadError('unsupported-browser-format');
    throw new LoadError('bad-file');
  }
}

async function isAnimatedWebp(buf: ArrayBuffer) {
  const b = new Uint8Array(buf.slice(0, 64));
  const s = String.fromCharCode(...b);
  return s.includes('ANIM') || s.includes('VP8X') && (b[20] & 0x02) !== 0;
}

export function loadErrorMessage(code: string) {
  switch (code) {
    case 'too-big':
      return 'הקובץ גדול מ־50 מגה־בייט. נסו קובץ קטן יותר.';
    case 'unsupported':
      return `סוג הקובץ לא נתמך. פורמטים נתמכים: ${SUPPORTED_LABEL}.`;
    case 'unsupported-browser-format':
      return 'הדפדפן הזה לא יודע לפענח את סוג האנימציה הזה. נסו בכרום או באדג׳, או השתמשו בקובץ GIF.';
    default:
      return `לא הצלחנו לקרוא את הקובץ. ייתכן שהוא פגום. פורמטים נתמכים: ${SUPPORTED_LABEL}.`;
  }
}
