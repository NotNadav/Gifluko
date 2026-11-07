import { describe, expect, it } from 'vitest';
import { GIFEncoder } from 'gifenc';
import { decompressFrames, parseGIF } from 'gifuct-js';
import { composeGifFrames } from '../src/decode/gif';
import { normalizeDelay, readGifLoopCount } from '../src/decode/loopCount';
import { createGifStream, repeatFor } from '../src/export/gifCore';

const toBuf = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

function solidFrame(w: number, h: number, rgba: [number, number, number, number]) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) out.set(rgba, i * 4);
  return out;
}

function decodeAll(bytes: Uint8Array) {
  const gif = parseGIF(toBuf(bytes));
  const frames = decompressFrames(gif, true);
  const out: Uint8ClampedArray[] = [];
  composeGifFrames(frames, gif.lsd.width, gif.lsd.height, (rgba) => out.push(rgba));
  return { gif, frames, composed: out };
}

describe('loop count', () => {
  it('reads NETSCAPE2.0 loop values', () => {
    for (const [repeat, expected] of [
      [0, 0],
      [3, 3],
      [-1, null]
    ] as const) {
      const enc = GIFEncoder();
      enc.writeFrame(new Uint8Array(4), 2, 2, { palette: [[0, 0, 0], [255, 255, 255]], repeat, delay: 100 });
      enc.finish();
      expect(readGifLoopCount(enc.bytes())).toBe(expected);
    }
  });

  it('maps loop modes to encoder repeat values', () => {
    expect(repeatFor('source', 1, null)).toBe(-1);
    expect(repeatFor('source', 1, 0)).toBe(0);
    expect(repeatFor('source', 1, 4)).toBe(4);
    expect(repeatFor('forever', 1, null)).toBe(0);
    expect(repeatFor('count', 1, 0)).toBe(-1);
    expect(repeatFor('count', 3, 0)).toBe(2);
  });

  it('normalizes too-short delays like browsers do', () => {
    expect(normalizeDelay(0)).toBe(100);
    expect(normalizeDelay(10)).toBe(100);
    expect(normalizeDelay(20)).toBe(20);
    expect(normalizeDelay(70)).toBe(70);
  });
});

describe('frame composition', () => {
  it('applies transparency and disposal methods', () => {
    const W = 4;
    const H = 1;
    const enc = GIFEncoder();
    const pal = [[255, 0, 0], [0, 0, 255], [0, 255, 0], [0, 0, 0]];
    enc.writeFrame(new Uint8Array([0, 0, 0, 0]), W, H, { palette: pal, delay: 100, repeat: 0, dispose: 1 });
    enc.writeFrame(new Uint8Array([1, 3, 3, 3]), W, H, { palette: pal, delay: 100, transparent: true, transparentIndex: 3, dispose: 1 });
    enc.writeFrame(new Uint8Array([3, 2, 3, 3]), W, H, { palette: pal, delay: 100, transparent: true, transparentIndex: 3, dispose: 2 });
    enc.writeFrame(new Uint8Array([3, 3, 1, 3]), W, H, { palette: pal, delay: 100, transparent: true, transparentIndex: 3, dispose: 1 });
    enc.finish();
    const { composed } = decodeAll(enc.bytes());
    const px = (f: Uint8ClampedArray, i: number) => Array.from(f.slice(i * 4, i * 4 + 4));
    expect(px(composed[1], 0)).toEqual([0, 0, 255, 255]);
    expect(px(composed[1], 1)).toEqual([255, 0, 0, 255]);
    expect(px(composed[2], 1)).toEqual([0, 255, 0, 255]);
    expect(px(composed[3], 0)[3]).toBe(0);
    expect(px(composed[3], 2)).toEqual([0, 0, 255, 255]);
  });
});

describe('gif export stream', () => {
  it('round-trips frames, delays and loop count with delta optimization', () => {
    const W = 16;
    const H = 8;
    const frames: Uint8ClampedArray[] = [];
    for (let k = 0; k < 4; k++) {
      const f = solidFrame(W, H, [20, 40, 200, 255]);
      for (let y = 0; y < H; y++) f.set([250, 250, 250, 255], (y * W + k * 3) * 4);
      frames.push(f);
    }
    const delays = [100, 70, 40, 200];
    const s = createGifStream({ width: W, height: H, colors: 16, dither: 'none', repeat: 0, hasAlpha: false, optimize: true });
    frames.forEach((f, i) => s.add(f, delays[i]));
    const bytes = s.finish();
    const { frames: parsed, composed } = decodeAll(bytes);
    expect(parsed.map((f) => f.delay)).toEqual(delays);
    expect(readGifLoopCount(bytes)).toBe(0);
    composed.forEach((c, i) => {
      for (let p = 0; p < W * H * 4; p++) expect(Math.abs(c[p] - frames[i][p])).toBeLessThanOrEqual(8);
    });
    expect(parsed[1].transparentIndex).toBeGreaterThanOrEqual(0);
  });

  it('keeps transparency for sources with alpha', () => {
    const W = 4;
    const H = 4;
    const f = solidFrame(W, H, [0, 0, 0, 0]);
    f.set([255, 255, 255, 255], 0);
    const s = createGifStream({ width: W, height: H, colors: 8, dither: 'floyd', repeat: -1, hasAlpha: true, optimize: true });
    s.add(f, 100);
    s.add(f, 100);
    const bytes = s.finish();
    const { composed } = decodeAll(bytes);
    expect(readGifLoopCount(bytes)).toBeNull();
    expect(Array.from(composed[1].slice(0, 4))).toEqual([255, 255, 255, 255]);
    expect(composed[1][7]).toBe(0);
  });
});
