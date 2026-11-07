import { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Monitor, Search, Upload } from 'lucide-react';
import { allFonts, BUILTIN_FONTS, ensureFont, getFont, loadLocalFonts, localFontsSupported, type FontDef } from '../../fonts/registry';
import { toast, useEditor } from '../../store/editor';
import { pickFile, uploadFontFile } from '../../app/actions';

const SAMPLE = 'כשהקוד עובד';

export function FontPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hebrewOnly, setHebrewOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const fontsVersion = useEditor((s) => s.fontsVersion);
  const missing = useEditor((s) => s.missingFonts.includes(value));
  const current = getFont(value);

  useEffect(() => {
    if (!open) return;
    for (const f of BUILTIN_FONTS) ensureFont(f.id, f.weights.includes(700) ? 700 : f.weights[f.weights.length - 1], false, SAMPLE + f.label).catch(() => undefined);
  }, [open]);

  const fonts = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allFonts().filter((f) => (!hebrewOnly || f.hebrew) && (!term || f.label.toLowerCase().includes(term)));
  }, [q, hebrewOnly, fontsVersion, open]);

  const groups: [string, FontDef[]][] = [
    ['פונטים מובנים', fonts.filter((f) => f.source === 'builtin')],
    ['פונטים שהועלו', fonts.filter((f) => f.source === 'custom')],
    ['פונטים מהמחשב', fonts.filter((f) => f.source === 'local')]
  ];

  const loadLocal = async () => {
    setBusy(true);
    try {
      const list = await loadLocalFonts();
      toast(`נמצאו ${list.length} משפחות פונטים במחשב.`);
    } catch {
      toast('הדפדפן לא אישר גישה לפונטים של המחשב.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    const file = await pickFile('.ttf,.otf,.woff,.woff2');
    if (!file) return;
    const def = await uploadFontFile(file);
    if (def) onChange(def.id);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="field flex items-center justify-between gap-2 text-right" aria-label={`פונט: ${current?.label ?? value}`}>
          <span className="truncate" style={{ fontFamily: current ? `"${current.family}"` : undefined }}>
            {current?.label ?? value.replace(/^(local|custom):/, '')}
            {missing && <span className="ms-1 text-[11px] text-amber-600">(חסר)</span>}
          </span>
          <ChevronDown size={14} className="shrink-0 text-ink-faint" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={8} align="start" className="z-50 flex max-h-[min(520px,80vh)] w-80 flex-col rounded-lg border border-line bg-white shadow-xl" dir="rtl">
          <div className="space-y-2 border-b border-line p-2">
            <div className="relative">
              <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input autoFocus className="field pr-8" placeholder="חיפוש פונט" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש פונט" />
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={hebrewOnly} onChange={(e) => setHebrewOnly(e.target.checked)} />
              רק פונטים שתומכים בעברית
            </label>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1" role="listbox" aria-label="רשימת פונטים">
            {groups.map(([title, list]) =>
              list.length ? (
                <div key={title} className="mb-1">
                  <div className="px-2 pb-1 pt-2 text-[11px] font-semibold text-ink-faint">{title}</div>
                  {list.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="option"
                      aria-selected={f.id === value}
                      onClick={() => {
                        onChange(f.id);
                        setOpen(false);
                      }}
                      className={`focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right hover:bg-accent-soft ${f.id === value ? 'bg-accent-soft' : ''}`}
                    >
                      <span className="w-4 shrink-0 text-accent">{f.id === value && <Check size={14} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg leading-tight" style={{ fontFamily: `"${f.family}", sans-serif`, fontWeight: f.weights.includes(700) ? 700 : f.weights[f.weights.length - 1] }}>
                          {SAMPLE}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-ink-faint" dir="ltr">
                          {f.label}
                          {!f.hebrew && ' · ללא עברית'}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null
            )}
            {fonts.length === 0 && <div className="p-4 text-center text-sm text-ink-faint">לא נמצאו פונטים</div>}
          </div>
          <div className="flex gap-1.5 border-t border-line p-2">
            <button type="button" className="btn-outline flex-1 text-xs" onClick={upload}>
              <Upload size={14} /> קובץ פונט
            </button>
            {localFontsSupported() && (
              <button type="button" className="btn-outline flex-1 text-xs" onClick={loadLocal} disabled={busy}>
                <Monitor size={14} /> פונטים מהמחשב
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
