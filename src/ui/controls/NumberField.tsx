import { useEffect, useId, useRef, useState } from 'react';
import { beginGesture, endGesture } from '../../store/editor';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  precision?: number;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function NumberField({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, unit, precision, disabled, className = '', compact }: Props) {
  const id = useId();
  const digits = precision ?? (step < 1 ? Math.max(1, Math.ceil(-Math.log10(step))) : 0);
  const fmt = (v: number) => (Number.isFinite(v) ? String(Number(v.toFixed(digits))) : '');
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value, digits]);

  const commitText = () => {
    const n = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(n)) {
      const v = clamp(Number(n.toFixed(digits)), min, max);
      if (v !== value) onChange(v);
      setText(fmt(v));
    } else setText(fmt(value));
  };

  const nudge = (dir: number, big: boolean) => {
    const v = clamp(Number((value + dir * step * (big ? 10 : 1)).toFixed(digits)), min, max);
    onChange(v);
    setText(fmt(v));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, v: value, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 3) return;
    if (!d.moved) {
      d.moved = true;
      beginGesture();
    }
    const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const range = Number.isFinite(max - min) ? max - min : 400;
    const per = Math.max(step, range / 600) * factor;
    const v = clamp(Number((d.v + Math.round(dx / 2) * per).toFixed(digits)), min, max);
    onChange(v);
    setText(fmt(v));
  };
  const onPointerUp = () => {
    if (drag.current?.moved) endGesture();
    drag.current = null;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor={id}
        className={`label shrink-0 select-none ${disabled ? '' : 'cursor-ew-resize'} ${compact ? 'w-auto' : 'w-[4.5rem]'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="גררו ימינה או שמאלה לשינוי הערך"
      >
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          className="field pr-8 text-left tabular-nums"
          dir="ltr"
          inputMode="decimal"
          disabled={disabled}
          value={text}
          onFocus={(e) => {
            focused.current = true;
            e.target.select();
          }}
          onBlur={() => {
            focused.current = false;
            commitText();
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitText();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setText(fmt(value));
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              nudge(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
            }
          }}
        />
        {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-faint">{unit}</span>}
      </div>
    </div>
  );
}
