import { describe, expect, it } from 'vitest';
import { changedMask, mapToPalette } from '../src/export/dither';
import { frameSelection, outputName, outputSize } from '../src/export/exporter';
import { base64ToBytes, normalizeDoc } from '../src/persist/projectFile';
import { normalizeHex, hexToRgba } from '../src/lib/color';

describe('palette mapping', () => {
  const palette = [[0, 0, 0], [255, 255, 255], [255, 0, 0]];
  const rgba = new Uint8ClampedArray([0, 0, 0, 255, 250, 250, 250, 255, 240, 10, 10, 255, 9, 9, 9, 0]);
  it('maps to nearest colour and transparency', () => {
    const idx = mapToPalette(rgba, 4, 1, { palette: [...palette, [0, 0, 0]], dither: 'none', transparentIndex: 3 });
    expect(Array.from(idx)).toEqual([0, 1, 2, 3]);
  });
  it('produces valid indices with every dither mode', () => {
    for (const dither of ['floyd', 'bayer4', 'bayer8'] as const) {
      const idx = mapToPalette(rgba, 2, 2, { palette, dither, transparentIndex: -1 });
      expect(Array.from(idx).every((i) => i >= 0 && i < palette.length)).toBe(true);
    }
  });
  it('detects unchanged pixels and tracks the reference', () => {
    const ref = new Uint8ClampedArray([10, 10, 10, 255, 50, 50, 50, 255]);
    const cur = new Uint8ClampedArray([11, 10, 10, 255, 90, 50, 50, 255]);
    const { skip, changed } = changedMask(cur, ref, 2);
    expect(Array.from(skip)).toEqual([1, 0]);
    expect(changed).toBe(1);
    expect(ref[4]).toBe(90);
  });
});

describe('export helpers', () => {
  it('merges delays when skipping frames', () => {
    expect(frameSelection([10, 20, 30, 40, 50], 2)).toEqual({ indices: [0, 2, 4], delays: [30, 70, 50] });
  });
  it('computes output size and even sizes for mp4', () => {
    expect(outputSize({ width: 481, height: 271 }, { scale: 100, format: 'gif' })).toEqual({ w: 481, h: 271 });
    expect(outputSize({ width: 481, height: 271 }, { scale: 100, format: 'mp4' })).toEqual({ w: 480, h: 270 });
    expect(outputSize({ width: 400, height: 200 }, { scale: 50, format: 'gif' })).toEqual({ w: 200, h: 100 });
  });
  it('names files from the source', () => {
    expect(outputName('cat.party.gif', 'gif')).toBe('cat.party-caption.gif');
    expect(outputName('חתול.gif', 'mp4')).toBe('חתול-caption.mp4');
  });
});

describe('project data', () => {
  it('fills missing fields from defaults', () => {
    const d = normalizeDoc({ layers: [{ id: 'a', text: 'hi', stroke: { width: 9 } }] });
    expect(d.layers[0].stroke).toEqual({ color: '#000000', width: 9 });
    expect(d.layers[0].fontFamily).toBe('heebo');
    expect(d.exportSettings.colors).toBe(256);
  });
  it('decodes base64', () => {
    expect(Array.from(base64ToBytes('AAEC/w=='))).toEqual([0, 1, 2, 255]);
  });
  it('parses colours', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('zz')).toBeNull();
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
});
