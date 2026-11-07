import { Maximize, Scan, ZoomIn, ZoomOut } from 'lucide-react';
import { useEditor, zoomBy } from '../store/editor';

export function PlaybackBar() {
  const zoom = useEditor((s) => s.zoom);
  const fit = useEditor((s) => s.fit);
  const showSafe = useEditor((s) => s.showSafe);
  return (
    <footer className="flex h-11 shrink-0 items-center gap-2 border-t border-line bg-white px-2 text-sm sm:px-3">
      <div className="flex-1" />
      <button
        type="button"
        className={`btn-ghost hidden px-2 sm:inline-flex ${showSafe ? 'text-accent' : ''}`}
        aria-pressed={showSafe}
        onClick={() => useEditor.setState({ showSafe: !showSafe })}
        title="שוליים בטוחים"
        aria-label="הצגת שוליים בטוחים"
      >
        <Scan size={16} />
      </button>
      <button type="button" className="btn-ghost px-1.5" onClick={() => zoomBy(-1)} aria-label="זום החוצה" title="זום החוצה (-)">
        <ZoomOut size={16} />
      </button>
      <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" className="btn-ghost px-1.5" onClick={() => zoomBy(1)} aria-label="זום פנימה" title="זום פנימה (+)">
        <ZoomIn size={16} />
      </button>
      <button
        type="button"
        className={`btn-ghost px-1.5 ${fit ? 'text-accent' : ''}`}
        onClick={() => useEditor.setState({ fit: true })}
        aria-label="התאמה למסך"
        title="התאמה למסך (0)"
      >
        <Maximize size={16} />
      </button>
      <button type="button" className="btn-ghost hidden px-1.5 text-xs sm:inline-flex" onClick={() => useEditor.setState({ zoom: 1, fit: false })} title="גודל אמיתי">
        1:1
      </button>
    </footer>
  );
}
