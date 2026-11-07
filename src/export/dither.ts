import type { DitherMode } from '../model/types';

export type Palette = number[][];

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER8 = (() => {
  const m: number[] = new Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = BAYER4[(y % 4) * 4 + (x % 4)] * 4 + [0, 2, 3, 1][((y >> 2) & 1) * 2 + ((x >> 2) & 1)];
      m[y * 8 + x] = v;
    }
  }
  return m;
})();

export function createNearest(palette: Palette, exclude = -1) {
  const cache = new Int16Array(1 << 18).fill(-1);
  const n = palette.length;
  const pr = new Int32Array(n);
  const pg = new Int32Array(n);
  const pb = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    pr[i] = palette[i][0];
    pg[i] = palette[i][1];
    pb[i] = palette[i][2];
  }
  return (r: number, g: number, b: number) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    const c = cache[key];
    if (c >= 0) return c;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      if (i === exclude) continue;
      const dr = r - pr[i];
      const dg = g - pg[i];
      const db = b - pb[i];
      const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
      if (d < bestD) {
        bestD = d;
        best = i;
        if (d === 0) break;
      }
    }
    cache[key] = best;
    return best;
  };
}

export interface MapOptions {
  palette: Palette;
  dither: DitherMode;
  transparentIndex: number;
  skip?: Uint8Array | null;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function mapToPalette(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, opts: MapOptions): Uint8Array {
  const { palette, dither, transparentIndex, skip } = opts;
  const out = new Uint8Array(width * height);
  const nearest = createNearest(palette, transparentIndex);
  const isTransparent = (p: number) => rgba[p * 4 + 3] < 128 || (skip != null && skip[p] === 1);

  if (dither === 'floyd') {
    let cur = new Float32Array((width + 2) * 3);
    let next = new Float32Array((width + 2) * 3);
    for (let y = 0; y < height; y++) {
      next.fill(0);
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (transparentIndex >= 0 && isTransparent(p)) {
          out[p] = transparentIndex;
          continue;
        }
        const e = (x + 1) * 3;
        const r = clamp(rgba[p * 4] + cur[e]);
        const g = clamp(rgba[p * 4 + 1] + cur[e + 1]);
        const b = clamp(rgba[p * 4 + 2] + cur[e + 2]);
        const idx = nearest(r | 0, g | 0, b | 0);
        out[p] = idx;
        const c = palette[idx];
        const er = r - c[0];
        const eg = g - c[1];
        const eb = b - c[2];
        cur[e + 3] += (er * 7) / 16;
        cur[e + 4] += (eg * 7) / 16;
        cur[e + 5] += (eb * 7) / 16;
        next[e - 3] += (er * 3) / 16;
        next[e - 2] += (eg * 3) / 16;
        next[e - 1] += (eb * 3) / 16;
        next[e] += (er * 5) / 16;
        next[e + 1] += (eg * 5) / 16;
        next[e + 2] += (eb * 5) / 16;
        next[e + 3] += er / 16;
        next[e + 4] += eg / 16;
        next[e + 5] += eb / 16;
      }
      const t = cur;
      cur = next;
      next = t;
    }
    return out;
  }

  const bayer = dither === 'bayer4' ? BAYER4 : dither === 'bayer8' ? BAYER8 : null;
  const size = dither === 'bayer4' ? 4 : 8;
  const levels = size * size;
  const spread = bayer ? Math.min(64, 255 / Math.max(2, Math.cbrt(palette.length))) : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (transparentIndex >= 0 && isTransparent(p)) {
        out[p] = transparentIndex;
        continue;
      }
      let r = rgba[p * 4];
      let g = rgba[p * 4 + 1];
      let b = rgba[p * 4 + 2];
      if (bayer) {
        const t = ((bayer[(y % size) * size + (x % size)] + 0.5) / levels - 0.5) * spread;
        r = clamp(r + t) | 0;
        g = clamp(g + t) | 0;
        b = clamp(b + t) | 0;
      }
      out[p] = nearest(r, g, b);
    }
  }
  return out;
}

export function changedMask(cur: Uint8Array | Uint8ClampedArray, ref: Uint8Array | Uint8ClampedArray, tolerance: number): { skip: Uint8Array; changed: number } {
  const n = cur.length / 4;
  const skip = new Uint8Array(n);
  let changed = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (
      Math.abs(cur[i] - ref[i]) <= tolerance &&
      Math.abs(cur[i + 1] - ref[i + 1]) <= tolerance &&
      Math.abs(cur[i + 2] - ref[i + 2]) <= tolerance
    ) {
      skip[p] = 1;
    } else {
      changed++;
      ref[i] = cur[i];
      ref[i + 1] = cur[i + 1];
      ref[i + 2] = cur[i + 2];
    }
  }
  return { skip, changed };
}
