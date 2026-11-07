import { useState } from 'react';
import { Download, FolderOpen, Keyboard, Redo2, Undo2 } from 'lucide-react';
import { redo, undo, useEditor } from '../store/editor';
import { closeCurrent, openFile, pickFile } from '../app/actions';
import { ACCEPT } from '../decode/load';
import { ShortcutsHelp } from './ShortcutsHelp';

export function TopBar() {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasSource = useEditor((s) => !!s.source);
  const [help, setHelp] = useState(false);

  const open = async () => {
    const f = await pickFile(`${ACCEPT},.json`);
    if (f) await openFile(f);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 bg-[#1d1a26] px-2 text-white sm:px-3">
      <button
        type="button"
        className="focus-ring min-w-0 truncate rounded-md px-1 font-bold hover:text-white/80"
        dir="ltr"
        onClick={() => hasSource && void closeCurrent()}
        title="חזרה לדף הפתיחה"
        aria-label="Gifluko, חזרה לדף הפתיחה"
      >
        Gifluko
      </button>
      <div className="flex-1" />
      <button type="button" className="btn-dark px-2" onClick={undo} disabled={!canUndo} title="ביטול (Ctrl+Z)" aria-label="ביטול">
        <Undo2 size={16} /> <span className="hidden md:inline">ביטול</span>
      </button>
      <button type="button" className="btn-dark px-2" onClick={redo} disabled={!canRedo} title="חזרה (Ctrl+Shift+Z)" aria-label="חזרה">
        <Redo2 size={16} /> <span className="hidden md:inline">חזרה</span>
      </button>
      <div className="mx-1 h-5 w-px bg-white/15" />
      <button type="button" className="btn-dark px-2" onClick={open} title="פתיחה (Ctrl+O)" aria-label="פתיחת קובץ">
        <FolderOpen size={16} /> <span className="hidden md:inline">פתיחה</span>
      </button>
      <button type="button" className="btn-dark px-2" onClick={() => setHelp(true)} title="קיצורי מקלדת" aria-label="קיצורי מקלדת">
        <Keyboard size={16} />
      </button>
      <button
        type="button"
        className="btn-accent ms-1 px-3"
        disabled={!hasSource}
        onClick={() => useEditor.setState({ exportOpen: true })}
        title="ייצוא (Ctrl+Shift+E)"
      >
        <Download size={16} /> ייצוא
      </button>
      <ShortcutsHelp open={help} onOpenChange={setHelp} />
    </header>
  );
}
