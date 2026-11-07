import type { FFmpeg } from '@ffmpeg/ffmpeg';

let instance: Promise<FFmpeg> | null = null;

export function getFFmpeg(): Promise<FFmpeg> {
  if (!instance) {
    instance = (async () => {
      const [{ FFmpeg }, core, wasm] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/core?url'),
        import('@ffmpeg/core/wasm?url')
      ]);
      const ff = new FFmpeg();
      await ff.load({
        coreURL: new URL(core.default, location.href).href,
        wasmURL: new URL(wasm.default, location.href).href
      });
      return ff;
    })();
    instance.catch(() => {
      instance = null;
    });
  }
  return instance;
}

export function resetFFmpeg() {
  if (!instance) return;
  const p = instance;
  instance = null;
  p.then((ff) => ff.terminate()).catch(() => undefined);
}

export async function cleanFS(ff: FFmpeg, prefix: string) {
  try {
    const list = await ff.listDir('/');
    for (const e of list) if (!e.isDir && e.name.startsWith(prefix)) await ff.deleteFile(e.name);
  } catch {
    /* ignore */
  }
}
