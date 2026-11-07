import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Download, FileBraces, FolderOpen, Keyboard, Redo2, Undo2, X } from 'lucide-react';
import { redo, undo, useEditor } from '../store/editor';
import { closeCurrent, downloadProject, openFile, pickFile } from '../app/actions';
import { ACCEPT } from '../decode/load';
import { ShortcutsHelp } from './ShortcutsHelp';

export function TopBar() {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasSource = useEditor((s) => !!s.source);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);

  const open = async () => {
    const f = await pickFile(`${ACCEPT},.json`);
    if (f) await openFile(f);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 bg-[#1d1a26] px-2 text-white sm:px-3">
      <div className="flex min-w-0 items-center gap-2 font-bold">
        <span className="truncate" dir="ltr">
          Gifluko
        </span>
      </div>
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
      <Popover.Root open={menu} onOpenChange={setMenu}>
        <Popover.Trigger asChild>
          <button type="button" className="btn-dark px-1.5" aria-label="תפריט פרויקט" title="פרויקט">
            <ChevronDown size={16} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={6} align="end" collisionPadding={8} className="z-50 w-56 rounded-lg border border-line bg-white p-1 text-ink shadow-xl" dir="rtl">
            <MenuItem
              icon={<FileBraces size={15} />}
              disabled={!hasSource}
              onClick={() => {
                setMenu(false);
                void downloadProject();
              }}
            >
              הורדת קובץ פרויקט
            </MenuItem>
            <MenuItem
              icon={<Keyboard size={15} />}
              onClick={() => {
                setMenu(false);
                setHelp(true);
              }}
            >
              קיצורי מקלדת
            </MenuItem>
            <MenuItem
              icon={<X size={15} />}
              disabled={!hasSource}
              onClick={() => {
                setMenu(false);
                void closeCurrent();
              }}
            >
              סגירה וחזרה לדף הפתיחה
            </MenuItem>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
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

function MenuItem({ icon, children, onClick, disabled }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-sm hover:bg-accent-soft disabled:opacity-40">
      <span className="text-ink-soft">{icon}</span>
      {children}
    </button>
  );
}
