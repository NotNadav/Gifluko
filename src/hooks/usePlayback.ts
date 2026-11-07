import { useEffect } from 'react';
import { useEditor } from '../store/editor';

export function usePlayback() {
  const playing = useEditor((s) => s.playing);
  const source = useEditor((s) => s.source);
  useEffect(() => {
    if (!playing || !source || source.frameCount < 2) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(1000, now - last);
      last = now;
      let { frame } = useEditor.getState();
      let changed = false;
      while (acc >= source.delays[frame]) {
        acc -= source.delays[frame];
        frame = (frame + 1) % source.frameCount;
        changed = true;
      }
      if (changed) useEditor.setState({ frame });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, source]);
}
