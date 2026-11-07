import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

const ROWS: [string, string][] = [
  ['פתיחת קובץ', 'Ctrl + O'],
  ['ייצוא', 'Ctrl + Shift + E'],
  ['הוספת שכבת טקסט', 'T'],
  ['ביטול / חזרה', 'Ctrl + Z / Ctrl + Shift + Z'],
  ['שכפול שכבה', 'Ctrl + D'],
  ['מחיקת שכבה', 'Delete'],
  ['עריכת טקסט השכבה', 'Enter / לחיצה כפולה'],
  ['ניגון / עצירה', 'Space'],
  ['הזזה עדינה / מהירה', 'חיצים / Shift + חיצים'],
  ['זום פנימה / החוצה / התאמה', '+ / - / 0'],
  ['סיבוב בקפיצות של 15°', 'Shift בזמן סיבוב'],
  ['ביטול בחירה', 'Esc']
];

export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content dir="rtl" className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 text-ink shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">קיצורי מקלדת</Dialog.Title>
            <Dialog.Close className="btn-ghost px-1.5" aria-label="סגירה">
              <X size={16} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">רשימת קיצורי המקלדת של העורך</Dialog.Description>
          <table className="w-full text-sm">
            <tbody>
              {ROWS.map(([a, k]) => (
                <tr key={a} className="border-b border-line last:border-0">
                  <td className="py-1.5">{a}</td>
                  <td className="py-1.5 text-left font-mono text-xs text-ink-soft" dir="ltr">
                    {k}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
