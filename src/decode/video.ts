import { cleanFS, getFFmpeg } from '../lib/ffmpeg';

export const VIDEO_FPS = 15;
export const VIDEO_MAX_SECONDS = 20;
export const VIDEO_MAX_WIDTH = 640;

export async function decodeVideo(buffer: ArrayBuffer, fileName: string, onProgress?: (p: number) => void) {
  const ff = await getFFmpeg();
  const ext = (fileName.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const input = `vin.${ext}`;
  await cleanFS(ff, 'vf_');
  await ff.writeFile(input, new Uint8Array(buffer));
  const handler = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(0.9, progress * 0.9)));
  ff.on('progress', handler);
  try {
    const code = await ff.exec([
      '-i', input,
      '-t', String(VIDEO_MAX_SECONDS),
      '-vf', `fps=${VIDEO_FPS},scale=min(${VIDEO_MAX_WIDTH}\\,iw):-2:flags=lanczos`,
      '-an',
      'vf_%05d.png'
    ]);
    if (code !== 0) throw new Error('bad-file');
  } finally {
    ff.off('progress', handler);
  }
  const names = (await ff.listDir('/')).filter((e) => !e.isDir && e.name.startsWith('vf_')).map((e) => e.name).sort();
  if (!names.length) throw new Error('bad-file');
  const frames: ImageBitmap[] = [];
  for (let i = 0; i < names.length; i++) {
    const data = (await ff.readFile(names[i])) as Uint8Array;
    frames.push(await createImageBitmap(new Blob([data as BlobPart], { type: 'image/png' })));
    await ff.deleteFile(names[i]);
    onProgress?.(0.9 + (0.1 * (i + 1)) / names.length);
  }
  await ff.deleteFile(input).catch(() => undefined);
  const delay = Math.round(100 / VIDEO_FPS) * 10;
  return {
    frames,
    delays: frames.map(() => delay),
    width: frames[0].width,
    height: frames[0].height,
    loopCount: 0 as number | null
  };
}
