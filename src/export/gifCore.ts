import { GIFEncoder, quantize } from 'gifenc';
import type { DitherMode } from '../model/types';
import { changedMask, mapToPalette } from './dither';

export interface GifStreamOptions {
  width: number;
  height: number;
  colors: number;
  dither: DitherMode;
  repeat: number;
  hasAlpha: boolean;
  optimize: boolean;
  tolerance?: number;
}

export function createGifStream(opts: GifStreamOptions) {
  const enc = GIFEncoder();
  const { width, height } = opts;
  const colors = Math.max(2, Math.min(256, Math.round(opts.colors)));
  const delta = opts.optimize && !opts.hasAlpha;
  const tolerance = opts.tolerance ?? 2;
  let ref: Uint8ClampedArray | null = null;
  let count = 0;
  const sizes: number[] = [];

  function add(rgba: Uint8ClampedArray, delay: number) {
    const before = enc.bytesView().length;
    let frameAlpha = false;
    if (opts.hasAlpha) {
      for (let i = 3; i < rgba.length; i += 4) {
        if (rgba[i] < 128) {
          frameAlpha = true;
          break;
        }
      }
    }
    let skip: Uint8Array | null = null;
    let sample: Uint8ClampedArray = rgba;
    if (delta && ref) {
      const m = changedMask(rgba, ref, tolerance);
      skip = m.skip;
      sample = new Uint8ClampedArray(Math.max(1, m.changed) * 4);
      let k = 0;
      for (let p = 0; p < skip.length; p++) {
        if (skip[p]) continue;
        sample[k++] = rgba[p * 4];
        sample[k++] = rgba[p * 4 + 1];
        sample[k++] = rgba[p * 4 + 2];
        sample[k++] = 255;
      }
      if (m.changed === 0) sample.set([0, 0, 0, 255]);
    } else if (delta) {
      ref = new Uint8ClampedArray(rgba);
    }
    if (frameAlpha) {
      let opaque = 0;
      for (let i = 3; i < rgba.length; i += 4) if (rgba[i] >= 128) opaque++;
      const s = new Uint8ClampedArray(Math.max(1, opaque) * 4);
      let k = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3] < 128) continue;
        s[k++] = rgba[i];
        s[k++] = rgba[i + 1];
        s[k++] = rgba[i + 2];
        s[k++] = 255;
      }
      if (opaque === 0) s.set([0, 0, 0, 255]);
      sample = s;
    }
    const useTransparency = frameAlpha || skip != null;
    const palette = quantize(sample, useTransparency ? colors - 1 : colors, { format: 'rgb565' });
    let transparentIndex = -1;
    if (useTransparency) {
      palette.push([0, 0, 0]);
      transparentIndex = palette.length - 1;
    }
    const index = mapToPalette(rgba, width, height, { palette, dither: opts.dither, transparentIndex, skip });
    enc.writeFrame(index, width, height, {
      palette,
      delay,
      repeat: opts.repeat,
      transparent: useTransparency,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: opts.hasAlpha ? 2 : 1
    });
    count++;
    sizes.push(enc.bytesView().length - before);
  }

  function finish(): Uint8Array {
    enc.finish();
    return enc.bytes();
  }

  return { add, finish, sizes, get count() { return count; } };
}

export function repeatFor(loop: 'source' | 'forever' | 'count', loopTimes: number, sourceLoop: number | null): number {
  if (loop === 'forever') return 0;
  if (loop === 'count') return loopTimes <= 1 ? -1 : Math.min(65535, loopTimes - 1);
  return sourceLoop == null ? -1 : sourceLoop;
}
