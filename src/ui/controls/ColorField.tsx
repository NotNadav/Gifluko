import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { HexColorPicker } from 'react-colorful';
import { Pipette } from 'lucide-react';
import { getRecentColors, normalizeHex, pushRecentColor } from '../../lib/color';
import { beginGesture, endGesture, useEditor } from '../../store/editor';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  showHex?: boolean;
}

export function ColorField({ value, onChange, label, showHex = true }: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const [recent, setRecent] = useState<string[]>([]);
  const hasSource = useEditor((s) => !!s.source);

  useEffect(() => setHex(value), [value]);
  const [wasOpen, setWasOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setRecent(getRecentColors());
      setWasOpen(true);
    } else if (wasOpen) pushRecentColor(value);
  }, [open]);

  const pick = () => {
    setOpen(false);
    useEditor.setState({
      picking: (c) => {
        onChange(c);
        pushRecentColor(c);
      }
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${value}`}
            className="focus-ring checker h-8 w-10 shrink-0 overflow-hidden rounded-md border border-line"
          >
            <span className="block h-full w-full" style={{ background: value }} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={6} collisionPadding={8} className="z-50 w-60 space-y-2 rounded-lg border border-line bg-white p-3 shadow-xl" dir="rtl">
            <div onPointerDown={() => beginGesture()} onPointerUp={() => endGesture()} onPointerCancel={() => endGesture()}>
              <HexColorPicker color={normalizeHex(value) ?? '#000000'} onChange={onChange} />
            </div>
            <div className="flex items-center gap-1.5">
              <input
                className="field font-mono text-left"
                dir="ltr"
                aria-label="קוד צבע הקסדצימלי"
                value={hex}
                onChange={(e) => {
                  setHex(e.target.value);
                  const n = normalizeHex(e.target.value);
                  if (n) onChange(n);
                }}
              />
              {hasSource && (
                <button type="button" className="btn-outline h-8 shrink-0 px-2" onClick={pick} title="דגימת צבע מהגיף" aria-label="דגימת צבע מהגיף">
                  <Pipette size={15} />
                </button>
              )}
            </div>
            {recent.length > 0 && (
              <div>
                <div className="label mb-1">צבעים אחרונים</div>
                <div className="flex flex-wrap gap-1">
                  {recent.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      title={c}
                      className="focus-ring h-5 w-5 rounded border border-line"
                      style={{ background: c }}
                      onClick={() => onChange(c)}
                    />
                  ))}
                </div>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {showHex && (
        <input
          className="field min-w-0 font-mono text-left text-xs"
          dir="ltr"
          aria-label={`${label} (קוד)`}
          value={hex}
          onChange={(e) => {
            setHex(e.target.value);
            const n = normalizeHex(e.target.value);
            if (n) onChange(n);
          }}
          onBlur={() => setHex(value)}
        />
      )}
    </div>
  );
}
