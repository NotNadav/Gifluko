import { createGifStream, type GifStreamOptions } from './gifCore';

const ctx = self as unknown as Worker;

type Msg =
  | { type: 'start'; options: GifStreamOptions; total: number }
  | { type: 'frame'; rgba: ArrayBuffer; delay: number }
  | { type: 'end' };

let stream: ReturnType<typeof createGifStream> | null = null;
let total = 0;

ctx.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data;
  try {
    if (msg.type === 'start') {
      stream = createGifStream(msg.options);
      total = msg.total;
    } else if (msg.type === 'frame' && stream) {
      stream.add(new Uint8ClampedArray(msg.rgba), msg.delay);
      ctx.postMessage({ type: 'progress', done: stream.count, total });
    } else if (msg.type === 'end' && stream) {
      const bytes = stream.finish();
      const sizes = stream.sizes;
      stream = null;
      ctx.postMessage({ type: 'done', bytes, sizes }, [bytes.buffer]);
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
