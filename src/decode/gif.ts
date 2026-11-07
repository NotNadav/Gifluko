import { decompressFrames, parseGIF, type ParsedFrame } from 'gifuct-js';
import { normalizeDelay, readGifLoopCount } from './loopCount';
import { bitmapsHaveAlpha, canDecodeType, decodeWithImageDecoder } from './imageDecoder';

export function composeGifFrames(
  frames: ParsedFrame[],
  width: number,
  height: number,
  onFrame: (rgba: Uint8ClampedArray, index: number) => void
): boolean {
  const canvas = new Uint8ClampedArray(width * height * 4);
  let hasAlpha = false;
  frames.forEach((f, idx) => {
    const { top, left, width: fw, height: fh } = f.dims;
    const saved = f.disposalType === 3 ? canvas.slice() : null;
    const patch = f.patch;
    for (let y = 0; y < fh; y++) {
      const cy = top + y;
      if (cy < 0 || cy >= height) continue;
      for (let x = 0; x < fw; x++) {
        const cx = left + x;
        if (cx < 0 || cx >= width) continue;
        const si = (y * fw + x) * 4;
        if (patch[si + 3] === 0) continue;
        const di = (cy * width + cx) * 4;
        canvas[di] = patch[si];
        canvas[di + 1] = patch[si + 1];
        canvas[di + 2] = patch[si + 2];
        canvas[di + 3] = 255;
      }
    }
    const snap = canvas.slice();
    if (!hasAlpha) {
      for (let i = 3; i < snap.length; i += 4) {
        if (snap[i] < 255) {
          hasAlpha = true;
          break;
        }
      }
    }
    onFrame(snap, idx);
    if (f.disposalType === 2) {
      const x0 = Math.max(0, left);
      const x1 = Math.min(width, left + fw);
      for (let y = Math.max(0, top); y < Math.min(height, top + fh); y++) {
        if (x1 > x0) canvas.fill(0, (y * width + x0) * 4, (y * width + x1) * 4);
      }
    } else if (saved) canvas.set(saved);
  });
  return hasAlpha;
}

interface HeaderFrame {
  image?: unknown;
  gce?: { delay?: number; extras?: { transparentColorGiven?: boolean } };
}

async function decodeGifNative(buffer: ArrayBuffer, gif: ReturnType<typeof parseGIF>, onProgress?: (p: number) => void) {
  const meta = (gif.frames as HeaderFrame[]).filter((f) => f.image);
  const res = await decodeWithImageDecoder(buffer, 'image/gif', onProgress);
  if (res.frames.length !== meta.length || res.width !== gif.lsd.width || res.height !== gif.lsd.height) {
    res.frames.forEach((f) => f.close());
    throw new Error('mismatch');
  }
  const mayHaveAlpha = meta.some((f) => f.gce?.extras?.transparentColorGiven);
  return {
    width: res.width,
    height: res.height,
    frames: res.frames,
    delays: meta.map((f) => normalizeDelay((f.gce?.delay ?? 0) * 10)),
    loopCount: readGifLoopCount(new Uint8Array(buffer)),
    hasAlpha: mayHaveAlpha ? bitmapsHaveAlpha(res.frames, true) : false
  };
}

export async function decodeGif(buffer: ArrayBuffer, onProgress?: (p: number) => void) {
  const gif = parseGIF(buffer);
  const width = gif.lsd.width;
  const height = gif.lsd.height;
  if (!width || !height) throw new Error('bad-file');
  if (await canDecodeType('image/gif')) {
    try {
      return await decodeGifNative(buffer, gif, onProgress);
    } catch {
      /* fall back to the JS decoder */
    }
  }
  const parsed = decompressFrames(gif, true);
  if (!parsed.length) throw new Error('bad-file');
  const pending: Promise<ImageBitmap>[] = [];
  const hasAlpha = composeGifFrames(parsed, width, height, (rgba, i) => {
    pending.push(createImageBitmap(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, width, height)));
    onProgress?.((i + 1) / parsed.length);
  });
  const frames = await Promise.all(pending);
  return {
    width,
    height,
    frames,
    delays: parsed.map((f) => normalizeDelay(f.delay)),
    loopCount: readGifLoopCount(new Uint8Array(buffer)),
    hasAlpha
  };
}
