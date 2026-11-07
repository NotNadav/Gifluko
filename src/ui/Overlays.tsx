import { useEffect, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { dismissToast, useEditor } from '../store/editor';
import { openFile } from '../app/actions';

export function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-14 left-1/2 z-[60] flex w-[min(440px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm shadow-lg ${
            t.kind === 'error' ? 'bg-red-600 text-white' : t.kind === 'warn' ? 'bg-amber-100 text-amber-950' : 'bg-ink text-white'
          }`}
        >
          <span className="min-w-0 flex-1">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="shrink-0 opacity-70 hover:opacity-100" aria-label="סגירת הודעה" onClick={() => dismissToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function LoadingOverlay() {
  const loading = useEditor((s) => s.loading);
  if (!loading) return null;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-white/70 backdrop-blur-sm" role="alert" aria-busy="true">
      <div className="w-72 rounded-xl bg-white p-5 text-center shadow-2xl">
        <div className="mb-3 text-sm font-semibold">{loading.label}</div>
        <div className="h-2 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(4, Math.round(loading.progress * 100))}%` }} />
        </div>
      </div>
    </div>
  );
}

export function DropAndPaste() {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void openFile(f);
    };
    const paste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const item = items.find((i) => i.kind === 'file' && /^(image|video)\//.test(i.type)) ?? items.find((i) => i.kind === 'file');
      const f = item?.getAsFile();
      if (!f) return;
      e.preventDefault();
      const ext = f.type.split('/')[1]?.replace('jpeg', 'jpg') || 'gif';
      void openFile(new File([f], f.name && f.name !== 'image.png' ? f.name : `clipboard.${ext}`, { type: f.type }));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, []);
  if (!over) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-accent/15 p-6">
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl border-4 border-dashed border-accent bg-white/80 text-accent">
        <ImagePlus size={48} />
        <div className="text-xl font-bold">שחררו כדי לפתוח את הקובץ</div>
      </div>
    </div>
  );
}

export function checkBrowserSupport(): string[] {
  const missing: string[] = [];
  if (typeof Worker === 'undefined') missing.push('Web Workers');
  if (typeof createImageBitmap === 'undefined') missing.push('createImageBitmap');
  if (typeof indexedDB === 'undefined') missing.push('IndexedDB');
  if (typeof ResizeObserver === 'undefined') missing.push('ResizeObserver');
  if (typeof document === 'undefined' || !('fonts' in document)) missing.push('CSS Font Loading');
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (!c || !('direction' in c)) missing.push('Canvas 2D');
  } catch {
    missing.push('Canvas 2D');
  }
  return missing;
}

export function UnsupportedBrowser({ missing }: { missing: string[] }) {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        <h1 className="mb-2 text-xl font-bold">הדפדפן לא נתמך</h1>
        <p className="text-sm text-ink-soft">חסרות לדפדפן הזה יכולות שהעורך צריך ({missing.join(', ')}).</p>
        <p className="mt-3 text-sm">אפשר להשתמש בשתי הגרסאות האחרונות של כרום, אדג׳, פיירפוקס או ספארי במחשב.</p>
      </div>
    </main>
  );
}
