import type { ExportSettings, SourceData, TextLayer } from '../model/types';
import { composeFrame, createOverlayCanvas } from '../render/drawLayer';
import { ensureFont, nearestWeight } from '../fonts/registry';
import { applyCase } from '../render/layout';
import { repeatFor, type GifStreamOptions } from './gifCore';
import { cleanFS, getFFmpeg, resetFFmpeg } from '../lib/ffmpeg';

export class ExportCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

export interface ExportJob {
  source: SourceData;
  layers: TextLayer[];
  settings: ExportSettings;
  missing?: Set<string>;
  signal?: AbortSignal;
  onProgress?: (p: number, label: string) => void;
}

export function outputSize(source: { width: number; height: number }, settings: Pick<ExportSettings, 'scale' | 'format'>) {
  let w = Math.max(1, Math.round((source.width * settings.scale) / 100));
  let h = Math.max(1, Math.round((source.height * settings.scale) / 100));
  if (settings.format === 'mp4') {
    w = Math.max(2, w - (w % 2));
    h = Math.max(2, h - (h % 2));
  }
  return { w, h };
}

export function frameSelection(delays: number[], step: number) {
  const s = Math.max(1, Math.round(step));
  const indices: number[] = [];
  const outDelays: number[] = [];
  for (let i = 0; i < delays.length; i += s) {
    indices.push(i);
    let d = 0;
    for (let k = i; k < Math.min(delays.length, i + s); k++) d += delays[k];
    outDelays.push(d);
  }
  return { indices, delays: outDelays };
}

export async function prepareFonts(layers: TextLayer[], missing?: Set<string>) {
  await Promise.all(
    layers
      .filter((l) => l.visible && l.text.trim())
      .map((l) => {
        const id = missing?.has(l.fontFamily) ? 'heebo' : l.fontFamily;
        return ensureFont(id, nearestWeight(id, l.fontWeight), l.italic, applyCase(l.text, l.textCase));
      })
  );
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new ExportCancelled();
}

export function baseName(fileName: string) {
  return (fileName.replace(/\.[^.]+$/, '') || 'gif').replace(/[\\/:*?"<>|]+/g, '_');
}

export function outputName(fileName: string, format: ExportSettings['format']) {
  return `${baseName(fileName)}-caption.${format}`;
}

interface Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  render(i: number, flatten?: string): void;
}

async function makeRenderer(job: ExportJob): Promise<Renderer> {
  await prepareFonts(job.layers, job.missing);
  const { source } = job;
  const overlay = createOverlayCanvas(job.layers, source.width, source.height, { missing: job.missing });
  const { w, h } = outputSize(source, job.settings);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return {
    canvas,
    ctx,
    w,
    h,
    render(i, flatten) {
      composeFrame(ctx, source.frames[i], overlay, w, h, flatten);
    }
  };
}

function runGifWorker(
  options: GifStreamOptions,
  frames: { total: number; next: (i: number) => Promise<{ rgba: ArrayBuffer; delay: number }> },
  signal: AbortSignal | undefined,
  onProgress: (done: number, total: number) => void
): Promise<{ bytes: Uint8Array; sizes: number[] }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ExportCancelled());
      return;
    }
    const worker = new Worker(new URL('./gif.worker.ts', import.meta.url), { type: 'module' });
    const abort = () => {
      worker.terminate();
      reject(new ExportCancelled());
    };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.done, m.total);
      else if (m.type === 'done') {
        signal?.removeEventListener('abort', abort);
        worker.terminate();
        resolve({ bytes: m.bytes, sizes: m.sizes });
      } else if (m.type === 'error') {
        signal?.removeEventListener('abort', abort);
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      reject(new Error(e.message || 'worker-error'));
    };
    worker.postMessage({ type: 'start', options, total: frames.total });
    (async () => {
      try {
        for (let i = 0; i < frames.total; i++) {
          if (signal?.aborted) return;
          const f = await frames.next(i);
          worker.postMessage({ type: 'frame', rgba: f.rgba, delay: f.delay }, [f.rgba]);
          if (i % 4 === 3) await tick();
        }
        worker.postMessage({ type: 'end' });
      } catch (err) {
        worker.terminate();
        reject(err);
      }
    })();
  });
}

function gifOptions(job: ExportJob, w: number, h: number): GifStreamOptions {
  const s = job.settings;
  return {
    width: w,
    height: h,
    colors: s.colors,
    dither: 'none',
    repeat: repeatFor(s.loop, s.loopTimes, job.source.loopCount),
    hasAlpha: job.source.hasAlpha,
    optimize: s.optimize
  };
}

async function exportGif(job: ExportJob): Promise<Blob> {
  const r = await makeRenderer(job);
  const sel = frameSelection(job.source.delays, 1);
  const total = sel.indices.length;
  const { bytes } = await runGifWorker(
    gifOptions(job, r.w, r.h),
    {
      total,
      next: async (i) => {
        r.render(sel.indices[i]);
        const data = r.ctx.getImageData(0, 0, r.w, r.h).data;
        return { rgba: data.buffer as ArrayBuffer, delay: sel.delays[i] };
      }
    },
    job.signal,
    (done, t) => job.onProgress?.(done / t, `מקודד פריים ${done} מתוך ${t}`)
  );
  return new Blob([bytes as BlobPart], { type: 'image/gif' });
}

function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), type, quality));
}

async function exportPng(job: ExportJob, frameIndex: number): Promise<Blob> {
  const r = await makeRenderer(job);
  r.render(Math.min(frameIndex, job.source.frames.length - 1));
  return canvasBlob(r.canvas);
}

async function exportFfmpeg(job: ExportJob, format: 'mp4' | 'webp'): Promise<Blob> {
  job.onProgress?.(0, 'טוען את מנוע הווידאו…');
  const ff = await getFFmpeg();
  check(job.signal);
  const r = await makeRenderer(job);
  const sel = frameSelection(job.source.delays, 1);
  await cleanFS(ff, 'ex_');
  const lines: string[] = [];
  const onAbort = () => resetFFmpeg();
  job.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    for (let i = 0; i < sel.indices.length; i++) {
      check(job.signal);
      r.render(sel.indices[i], format === 'mp4' ? '#ffffff' : undefined);
      const png = new Uint8Array(await (await canvasBlob(r.canvas)).arrayBuffer());
      const name = `ex_${String(i).padStart(5, '0')}.png`;
      await ff.writeFile(name, png);
      lines.push(`file '${name}'`, `duration ${(sel.delays[i] / 1000).toFixed(3)}`);
      job.onProgress?.((0.5 * (i + 1)) / sel.indices.length, `מכין פריים ${i + 1} מתוך ${sel.indices.length}`);
    }
    lines.push(`file 'ex_${String(sel.indices.length - 1).padStart(5, '0')}.png'`);
    await ff.writeFile('ex_list.txt', new TextEncoder().encode(lines.join('\n')));
    const handler = ({ progress }: { progress: number }) => job.onProgress?.(0.5 + 0.5 * Math.max(0, Math.min(1, progress)), 'מקודד…');
    ff.on('progress', handler);
    const out = format === 'mp4' ? 'ex_out.mp4' : 'ex_out.webp';
    const loop = repeatFor(job.settings.loop, job.settings.loopTimes, job.source.loopCount);
    const args =
      format === 'mp4'
        ? ['-f', 'concat', '-safe', '0', '-i', 'ex_list.txt', '-fps_mode', 'vfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(qualityToCrf(job.settings.quality)), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
        : ['-f', 'concat', '-safe', '0', '-i', 'ex_list.txt', '-fps_mode', 'vfr', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', String(qualityToWebp(job.settings.quality)), '-loop', String(loop < 0 ? 1 : loop), out];
    let code: number;
    try {
      code = await ff.exec(args);
    } finally {
      ff.off('progress', handler);
    }
    check(job.signal);
    if (code !== 0) throw new Error('ffmpeg-failed');
    const data = (await ff.readFile(out)) as Uint8Array;
    await cleanFS(ff, 'ex_');
    return new Blob([data as BlobPart], { type: format === 'mp4' ? 'video/mp4' : 'image/webp' });
  } finally {
    job.signal?.removeEventListener('abort', onAbort);
  }
}

function qualityToCrf(quality: number) {
  const q = Math.max(1, Math.min(100, quality));
  return Math.round(40 - (q / 100) * 26);
}

function qualityToWebp(quality: number) {
  return Math.max(1, Math.min(100, Math.round(quality)));
}

export async function runExport(job: ExportJob, frameIndex = 0): Promise<Blob> {
  const fmt = job.settings.format;
  try {
    if (fmt === 'png') return await exportPng(job, frameIndex);
    if (fmt === 'mp4' || fmt === 'webp') return await exportFfmpeg(job, fmt);
    return await exportGif(job);
  } catch (e) {
    if (job.signal?.aborted) throw new ExportCancelled();
    throw e;
  }
}

export async function estimateGifSize(job: ExportJob): Promise<number> {
  const r = await makeRenderer(job);
  const sel = frameSelection(job.source.delays, 1);
  const n = sel.indices.length;
  const runLen = Math.min(n, 4);
  const starts = n <= 8 ? [0] : [0, Math.floor(n / 2)];
  let first = 0;
  let restSum = 0;
  let restCount = 0;
  for (const start of starts) {
    const count = n <= 8 ? n : runLen;
    const { sizes } = await runGifWorker(
      gifOptions(job, r.w, r.h),
      {
        total: count,
        next: async (i) => {
          r.render(sel.indices[start + i]);
          return { rgba: r.ctx.getImageData(0, 0, r.w, r.h).data.buffer as ArrayBuffer, delay: sel.delays[start + i] };
        }
      },
      job.signal,
      () => undefined
    );
    if (start === 0) first = sizes[0];
    for (let i = 1; i < sizes.length; i++) {
      restSum += sizes[i];
      restCount++;
    }
  }
  if (n === 1 || restCount === 0) return first + 20;
  return Math.round(first + (restSum / restCount) * (n - 1) + 20);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
