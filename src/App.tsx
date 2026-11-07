import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Layers, Plus, SlidersHorizontal, X } from 'lucide-react';
import { addLayer, useEditor } from './store/editor';
import { TopBar } from './ui/TopBar';
import { StartScreen } from './ui/StartScreen';
import { Workspace } from './ui/workspace/Workspace';
import { SettingsPanel } from './ui/panels/SettingsPanel';
import { LayersPanel } from './ui/panels/LayersPanel';
import { PlaybackBar } from './ui/PlaybackBar';
import { ExportDialog } from './ui/ExportDialog';
import { checkBrowserSupport, DropAndPaste, LoadingOverlay, Toasts, UnsupportedBrowser } from './ui/Overlays';
import { useShortcuts } from './hooks/useShortcuts';
import { initAutosave, restoreLast } from './app/actions';

function useIsMobile() {
  const q = '(max-width: 767px)';
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

let booted = false;

export default function App() {
  const missing = useMemo(checkBrowserSupport, []);
  const hasSource = useEditor((s) => !!s.source);
  const isMobile = useIsMobile();
  useShortcuts();

  useEffect(() => {
    if (booted || missing.length) return;
    booted = true;
    initAutosave();
    void restoreLast();
  }, []);

  if (missing.length) return <UnsupportedBrowser missing={missing} />;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      {hasSource ? (isMobile ? <MobileEditor /> : <DesktopEditor />) : <StartScreen />}
      <ExportDialog />
      <LoadingOverlay />
      <DropAndPaste />
      <Toasts />
    </div>
  );
}

function DesktopEditor() {
  return (
    <>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-panel lg:w-[320px]" aria-label="לוח הגדרות">
          <SettingsPanel />
        </aside>
        <Workspace />
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-line bg-panel lg:w-[240px]" aria-label="שכבות">
          <LayersPanel />
        </aside>
      </div>
      <PlaybackBar />
    </>
  );
}

function MobileEditor() {
  const panel = useEditor((s) => s.mobilePanel);
  const close = () => useEditor.setState({ mobilePanel: null });
  return (
    <>
      <Workspace />
      <PlaybackBar />
      <nav className="flex shrink-0 items-stretch border-t border-line bg-white pb-[env(safe-area-inset-bottom)]" aria-label="כלי עריכה">
        <button type="button" className="btn-ghost flex-1 flex-col gap-0.5 rounded-none py-2 text-xs" onClick={() => useEditor.setState({ mobilePanel: 'settings' })}>
          <SlidersHorizontal size={18} /> הגדרות
        </button>
        <button type="button" className="btn-ghost flex-1 flex-col gap-0.5 rounded-none py-2 text-xs" onClick={() => addLayer()}>
          <Plus size={18} /> טקסט חדש
        </button>
        <button type="button" className="btn-ghost flex-1 flex-col gap-0.5 rounded-none py-2 text-xs" onClick={() => useEditor.setState({ mobilePanel: 'layers' })}>
          <Layers size={18} /> שכבות
        </button>
      </nav>
      <Dialog.Root open={panel != null} onOpenChange={(v) => !v && close()} modal={false}>
        <Dialog.Portal>
          <Dialog.Content
            dir="rtl"
            onInteractOutside={(e) => e.preventDefault()}
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[62dvh] flex-col rounded-t-2xl border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,0.15)]"
          >
            <div className="flex items-center justify-between px-3 pt-2">
              <div className="mx-auto h-1.5 w-10 rounded-full bg-line" aria-hidden />
              <Dialog.Close className="btn-ghost absolute left-2 top-1.5 px-1.5" aria-label="סגירה">
                <X size={16} />
              </Dialog.Close>
            </div>
            <Dialog.Title className="sr-only">{panel === 'layers' ? 'שכבות' : 'הגדרות טקסט'}</Dialog.Title>
            <Dialog.Description className="sr-only">לוח עריכה</Dialog.Description>
            <div className="flex min-h-0 flex-1 flex-col">{panel === 'layers' ? <LayersPanel /> : <SettingsPanel />}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
