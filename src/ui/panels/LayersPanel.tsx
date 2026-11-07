import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, GripVertical, Lock, LockOpen, Plus, Trash, TriangleExclamationPoint } from 'lucide-react';
import type { TextLayer } from '../../model/types';
import { addLayer, addLayerWithStyle, deleteLayer, duplicateLayer, reorderLayers, updateLayer, useEditor } from '../../store/editor';
import { useLayerGeoms } from '../../render/useLayouts';
import { templatePlacement, TEMPLATES } from '../../model/templates';

export function LayersPanel() {
  const layers = useEditor((s) => s.doc.layers);
  const selectedId = useEditor((s) => s.selectedId);
  const geoms = useLayerGeoms();
  const missing = useEditor((s) => s.missingFonts);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const display = [...layers].reverse();
  const n = layers.length;
  const selIndex = layers.findIndex((l) => l.id === selectedId);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = layers.findIndex((l) => l.id === e.active.id);
    const to = layers.findIndex((l) => l.id === e.over!.id);
    if (from >= 0 && to >= 0) reorderLayers(from, to);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <h2 className="text-sm font-bold text-accent">שכבות</h2>
        <span className="text-xs text-ink-faint">{n}</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={display.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1" aria-label="רשימת שכבות">
              {display.map((l) => (
                <LayerRow key={l.id} layer={l} selected={l.id === selectedId} warn={geoms.get(l.id)?.overflow ?? false} missingFont={missing.includes(l.fontFamily)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="mt-2 flex gap-1">
          <button type="button" className="btn flex-1 justify-start border border-dashed border-line text-ink-soft hover:border-accent hover:text-accent" onClick={() => addLayer()}>
            <Plus size={14} /> שכבה חדשה
          </button>
          <TemplateMenu />
        </div>
      </div>
      {selectedId && (
        <div className="flex items-center justify-between gap-1 border-t border-line p-2">
          <button type="button" className="btn-ghost px-2" title="העלאה למעלה" aria-label="העלאת השכבה" disabled={selIndex >= n - 1} onClick={() => reorderLayers(selIndex, selIndex + 1)}>
            <ArrowUp size={15} />
          </button>
          <button type="button" className="btn-ghost px-2" title="הורדה למטה" aria-label="הורדת השכבה" disabled={selIndex <= 0} onClick={() => reorderLayers(selIndex, selIndex - 1)}>
            <ArrowDown size={15} />
          </button>
          <span className="flex-1" />
          <button type="button" className="btn-ghost px-2" title="שכפול (Ctrl+D)" aria-label="שכפול שכבה" onClick={() => duplicateLayer(selectedId)}>
            <Copy size={15} />
          </button>
          <button type="button" className="btn-ghost px-2 text-red-600 hover:bg-red-50" title="מחיקה (Delete)" aria-label="מחיקת שכבה" onClick={() => deleteLayer(selectedId)}>
            <Trash size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateMenu() {
  const [open, setOpen] = useState(false);
  const source = useEditor((s) => s.source);
  const saved = useEditor((s) => s.savedStyles);
  if (!source) return null;
  const add = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const style = t.style(source.width, source.height);
    addLayerWithStyle(style, templatePlacement(t, style, source.width, source.height), t.sample);
    setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="btn-outline px-2 text-xs" aria-label="הוספת שכבה מתבנית" title="הוספה מתבנית">
          תבנית <ChevronDown size={13} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} collisionPadding={8} className="z-50 w-48 rounded-lg border border-line bg-white p-1 shadow-xl" dir="rtl">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="focus-ring block w-full rounded-md px-2 py-1.5 text-right text-sm hover:bg-accent-soft" onClick={() => add(t.id)}>
              {t.name}
            </button>
          ))}
          {saved.length > 0 && <div className="my-1 border-t border-line" />}
          {saved.map((s) => (
            <button
              key={s.id}
              type="button"
              className="focus-ring block w-full truncate rounded-md px-2 py-1.5 text-right text-sm hover:bg-accent-soft"
              onClick={() => {
                addLayerWithStyle(s.style, undefined, s.name);
                setOpen(false);
              }}
            >
              {s.name}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function LayerRow({ layer, selected, warn, missingFont }: { layer: TextLayer; selected: boolean; warn: boolean; missingFont: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
  const [renaming, setRenaming] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const select = () => useEditor.setState({ selectedId: layer.id });
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 rounded-md border px-1 py-1 text-sm ${selected ? 'border-accent bg-accent-soft' : 'border-line bg-white hover:border-ink-faint/50'} ${isDragging ? 'z-10 shadow-lg' : ''} ${layer.visible ? '' : 'opacity-60'}`}
    >
      <button type="button" className="focus-ring cursor-grab rounded p-0.5 text-ink-faint hover:text-ink active:cursor-grabbing" aria-label={`גרירת השכבה ${layer.name}`} {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      {renaming ? (
        <input
          autoFocus
          className="field h-7 min-w-0 flex-1"
          defaultValue={layer.name}
          aria-label="שם השכבה"
          onBlur={(e) => {
            updateLayer(layer.id, { name: e.target.value.trim() || layer.name });
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setRenaming(false);
          }}
        />
      ) : (
        <button type="button" className="focus-ring min-w-0 flex-1 truncate rounded px-1 text-right" onClick={select} onDoubleClick={() => setRenaming(true)} aria-pressed={selected} title="לחיצה כפולה לשינוי שם">
          {layer.name}
        </button>
      )}
      {(warn || missingFont) && (
        <span className="text-amber-500" title={missingFont ? 'הפונט חסר' : 'הטקסט חורג מגבולות הגיף ויחתך'} aria-label={missingFont ? 'הפונט חסר' : 'הטקסט חורג מהגבולות'}>
          <TriangleExclamationPoint size={14} />
        </span>
      )}
      <button
        type="button"
        className="focus-ring rounded p-1 text-ink-faint hover:text-ink"
        aria-label={layer.visible ? 'הסתרת השכבה' : 'הצגת השכבה'}
        title={layer.visible ? 'הסתרה' : 'הצגה'}
        onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
      >
        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button
        type="button"
        className={`focus-ring rounded p-1 hover:text-ink ${layer.locked ? 'text-accent' : 'text-ink-faint'}`}
        aria-label={layer.locked ? 'שחרור נעילה' : 'נעילת השכבה'}
        title={layer.locked ? 'שחרור נעילה' : 'נעילה'}
        onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
      >
        {layer.locked ? <Lock size={14} /> : <LockOpen size={14} />}
      </button>
    </li>
  );
}
