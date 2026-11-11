import { normalizeDelay } from './loopCount';

interface IDTrack {
  frameCount: number;
  repetitionCount: number;
}
interface ImageDecoderLike {
  tracks: { ready: Promise<void>; selectedTrack: IDTrack | null };
  completed: Promise<void>;
  decode(o: { frameIndex: number }): Promise<{ image: VideoFrame }>;
  close(): void;
}
interface ImageDecoderCtor {
  new (o: { data: ArrayBuffer; type: string }): ImageDecoderLike;
  isTypeSupported(t: string): Promise<boolean>;
}

const ctor = () => (window as unknown as { ImageDecoder?: ImageDecoderCtor }).ImageDecoder;

export async function canDecodeType(type: string) {
  const C = typeof window !== 'undefined' ? ctor() : undefined;
  if (!C) return false;
  try {
    return await C.isTypeSupported(type);
  } catch {
    return false;
  }
}

export async function decodeWithImageDecoder(buffer: ArrayBuffer, type: string, onProgress?: (p: number) => void) {
  const C = ctor();
  if (!C) throw new Error('unsupported-browser-format');
  const dec = new C({ data: buffer, type });
  try {
    await dec.tracks.ready;
    await dec.completed.catch(() => undefined);
    const track = dec.tracks.selectedTrack;
    if (!track || !track.frameCount) throw new Error('bad-file');
    const n = track.frameCount;
    const frames: ImageBitmap[] = new Array(n);
    const delays: number[] = new Array(n);
    let done = 0;
    const BATCH = 8;
    try {
      for (let start = 0; start < n; start += BATCH) {
        const idx = Array.from({ length: Math.min(BATCH, n - start) }, (_, k) => start + k);
        await Promise.allSettled(
          idx.map(async (i) => {
            const { image } = await dec.decode({ frameIndex: i });
            try {
              frames[i] = await createImageBitmap(image);
              delays[i] = normalizeDelay((image.duration ?? 100000) / 1000);
            } finally {
              image.close();
            }
            onProgress?.(++done / n);
          })
        ).then((rs) => {
          const bad = rs.find((r): r is PromiseRejectedResult => r.status === 'rejected');
          if (bad) throw bad.reason;
        });
      }
    } catch (e) {
      frames.forEach((f) => f?.close());
      throw e;
    }
    const rep = track.repetitionCount;
    const loopCount = !isFinite(rep) ? 0 : rep > 0 ? rep : null;
    return { frames, delays, width: frames[0].width, height: frames[0].height, loopCount };
  } finally {
    dec.close();
  }
}

export function bitmapsHaveAlpha(frames: ImageBitmap[], all = false) {
  const c = document.createElement('canvas');
  const step = all ? 1 : Math.max(1, Math.floor(frames.length / 8));
  for (let i = 0; i < frames.length; i += step) {
    const f = frames[i];
    c.width = f.width;
    c.height = f.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(f, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let k = 3; k < d.length; k += 4) if (d[k] < 255) return true;
  }
  return false;
}
