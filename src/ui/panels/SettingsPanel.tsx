import { useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { Italic, Plus, Strikethrough, TextAlignCenter, TextAlignEnd, TextAlignJustify, TextAlignStart, Trash, Underline, Upload, X } from 'lucide-react';
import type { Anchor, TextLayer } from '../../model/types';
import { applyStyleToLayer, updateLayer, useEditor } from '../../store/editor';
import { NumberField } from '../controls/NumberField';
import { ColorField } from '../controls/ColorField';
import { FontPicker } from '../controls/FontPicker';
import { Row, Section, Segmented, SelectField, Toggle } from '../controls/basic';
import { getFont, nearestWeight } from '../../fonts/registry';
import { anchorPoint, edgeInset, templatePlacement, TEMPLATES } from '../../model/templates';
import { pickStyle } from '../../model/defaults';
import { deleteStyle, pickFile, saveStyle, uploadFontFile } from '../../app/actions';
import { letterSpacingSupported, wordSpacingSupported } from '../../render/layout';
import { FileInfo } from './FileInfo';

const WEIGHT_NAMES: Record<number, string> = { 100: 'דק מאוד', 200: 'דק', 300: 'קל', 400: 'רגיל', 500: 'בינוני', 600: 'חצי עבה', 700: 'עבה', 800: 'עבה מאוד', 900: 'שחור' };

export function SettingsPanel() {
  const layer = useEditor((s) => s.doc.layers.find((l) => l.id === s.selectedId));
  const [open, setOpen] = useState<string[]>(['text', 'type', 'layout', 'color', 'effects', 'position']);
  if (!layer) return <FileInfo />;
  const set = (patch: Partial<TextLayer>, key?: string) => updateLayer(layer.id, patch, key);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-bold text-accent">הגדרות טקסט</h2>
        <span className="max-w-[55%] truncate text-xs text-ink-faint" title={layer.name}>
          {layer.name}
        </span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <Accordion.Root type="multiple" value={open} onValueChange={setOpen}>
          <TextSection layer={layer} set={set} />
          <TypographySection layer={layer} set={set} />
          <LayoutSection layer={layer} set={set} />
          <ColorSection layer={layer} set={set} />
          <EffectsSection layer={layer} set={set} />
          <PositionSection layer={layer} set={set} />
          <StylesSection layer={layer} />
        </Accordion.Root>
      </div>
    </div>
  );
}

type SP = { layer: TextLayer; set: (patch: Partial<TextLayer>, key?: string) => void };

function TextSection({ layer, set }: SP) {
  return (
    <Section value="text" title="טקסט">
      <textarea
        dir="auto"
        aria-label="תוכן הטקסט"
        className="focus-ring min-h-[72px] w-full resize-y rounded-md border border-line bg-white p-2 text-sm"
        value={layer.text}
        onChange={(e) => set({ text: e.target.value }, `text:${layer.id}`)}
      />
      <p className="text-[11px] text-ink-faint">Enter יוצר שורה חדשה. אפשר גם לערוך בלחיצה כפולה על הטקסט בגיף.</p>
    </Section>
  );
}

function TypographySection({ layer, set }: SP) {
  const def = getFont(layer.fontFamily);
  const missing = useEditor((s) => s.missingFonts.includes(layer.fontFamily));
  const weights = def?.weights?.length ? def.weights : [400, 700];
  const lsOk = letterSpacingSupported();
  return (
    <Section value="type" title="טיפוגרפיה">
      <Row label="פונט">
        <FontPicker
          value={layer.fontFamily}
          onChange={(id) => set({ fontFamily: id, fontWeight: nearestWeight(id, layer.fontWeight) }, `font:${layer.id}:${Date.now()}`)}
        />
      </Row>
      {missing && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          הפונט לא נמצא ומוצג זמנית ב־Heebo.
          <button
            type="button"
            className="btn-outline mt-1.5 w-full text-xs"
            onClick={async () => {
              const f = await pickFile('.ttf,.otf,.woff,.woff2');
              if (f) await uploadFontFile(f, layer.fontFamily);
            }}
          >
            <Upload size={13} /> טעינת קובץ הפונט
          </button>
        </div>
      )}
      <NumberField label="גודל" value={layer.fontSize} min={4} max={400} unit="px" disabled={layer.autoSize && layer.boxMode === 'fixed'} onChange={(v) => set({ fontSize: v })} />
      <Toggle label="התאמה אוטומטית לרוחב התיבה" checked={layer.autoSize && layer.boxMode === 'fixed'} onChange={(v) => set({ autoSize: v, boxMode: v ? 'fixed' : layer.boxMode })}>
        התאמה אוטומטית לרוחב התיבה
      </Toggle>
      <Row label="משקל">
        <SelectField
          label="משקל"
          value={nearestWeight(layer.fontFamily, layer.fontWeight)}
          options={weights.map((w) => ({ value: w, label: `${w} · ${WEIGHT_NAMES[w] ?? ''}` }))}
          onChange={(v) => set({ fontWeight: v })}
        />
      </Row>
      <Row label="סגנון">
        <div className="seg" role="group" aria-label="סגנון">
          <button type="button" aria-pressed={layer.italic} title="נטוי" aria-label="נטוי" onClick={() => set({ italic: !layer.italic })}>
            <Italic size={15} />
          </button>
          <button type="button" aria-pressed={layer.underline} title="קו תחתון" aria-label="קו תחתון" onClick={() => set({ underline: !layer.underline })}>
            <Underline size={15} />
          </button>
          <button type="button" aria-pressed={layer.strike} title="קו חוצה" aria-label="קו חוצה" onClick={() => set({ strike: !layer.strike })}>
            <Strikethrough size={15} />
          </button>
        </div>
      </Row>
      <Row label="רישיות">
        <Segmented
          label="רישיות"
          value={layer.textCase}
          onChange={(v) => set({ textCase: v })}
          options={[
            { value: 'none', label: 'רגיל', title: 'כפי שהוקלד' },
            { value: 'upper', label: 'AB' },
            { value: 'lower', label: 'ab' }
          ]}
        />
      </Row>
      <NumberField label="ריווח אותיות" value={layer.letterSpacing} min={-20} max={100} unit="%" disabled={!lsOk} onChange={(v) => set({ letterSpacing: v })} />
      {!lsOk && <p className="text-[11px] text-amber-700">הדפדפן הזה לא תומך בריווח אותיות על משטח ציור.</p>}
      <NumberField label="גובה שורה" value={layer.lineHeight} min={0.6} max={3} step={0.05} precision={2} onChange={(v) => set({ lineHeight: v })} />
    </Section>
  );
}

function LayoutSection({ layer, set }: SP) {
  return (
    <Section value="layout" title="פריסה">
      <Row label="יישור">
        <Segmented
          label="יישור"
          value={layer.align}
          onChange={(v) => set({ align: v })}
          options={[
            { value: 'right', label: <TextAlignEnd size={15} />, title: 'ימין' },
            { value: 'center', label: <TextAlignCenter size={15} />, title: 'מרכז' },
            { value: 'left', label: <TextAlignStart size={15} />, title: 'שמאל' },
            { value: 'justify', label: <TextAlignJustify size={15} />, title: 'מיושר לשני הצדדים' }
          ]}
        />
      </Row>
      {layer.align === 'justify' && !wordSpacingSupported() && <p className="text-[11px] text-amber-700">יישור לשני הצדדים לא נתמך בדפדפן הזה, הטקסט מיושר להתחלה.</p>}
      <Row label="כיוון">
        <Segmented
          label="כיוון כתיבה"
          value={layer.direction}
          onChange={(v) => set({ direction: v })}
          options={[
            { value: 'auto', label: 'אוטומטי' },
            { value: 'rtl', label: 'RTL' },
            { value: 'ltr', label: 'LTR' }
          ]}
        />
      </Row>
      <Row label="רוחב תיבה">
        <Segmented
          label="רוחב תיבה"
          value={layer.boxMode}
          onChange={(v) => set({ boxMode: v })}
          options={[
            { value: 'fixed', label: 'קבוע עם גלישה' },
            { value: 'auto', label: 'לפי התוכן' }
          ]}
        />
      </Row>
      {layer.boxMode === 'fixed' && <NumberField label="רוחב" value={layer.boxWidth} min={10} max={10000} unit="px" onChange={(v) => set({ boxWidth: v })} />}
    </Section>
  );
}

function ColorSection({ layer, set }: SP) {
  const fill = layer.fill;
  const setFill = (patch: Partial<TextLayer['fill']>, key?: string) => set({ fill: { ...fill, ...patch } }, key);
  const setGrad = (patch: Partial<TextLayer['fill']['gradient']>, key?: string) => setFill({ gradient: { ...fill.gradient, ...patch } }, key);
  const stops = fill.gradient.stops;
  const css = `linear-gradient(to left, ${[...stops].sort((a, b) => a.offset - b.offset).map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`;
  return (
    <Section value="color" title="צבע">
      <Row label="מילוי">
        <Segmented
          label="סוג מילוי"
          value={fill.type}
          onChange={(v) => setFill({ type: v })}
          options={[
            { value: 'solid', label: 'צבע אחיד' },
            { value: 'gradient', label: 'מעבר צבע' }
          ]}
        />
      </Row>
      {fill.type === 'solid' ? (
        <Row label="צבע">
          <ColorField label="צבע מילוי" value={fill.value} onChange={(c) => setFill({ value: c }, `fill:${layer.id}`)} />
        </Row>
      ) : (
        <div className="space-y-2 rounded-md border border-line p-2">
          <div className="h-4 rounded" style={{ background: css }} aria-hidden />
          <Segmented
            label="סוג מעבר"
            value={fill.gradient.kind}
            onChange={(v) => setGrad({ kind: v })}
            options={[
              { value: 'linear', label: 'ליניארי' },
              { value: 'radial', label: 'מעגלי' }
            ]}
          />
          {fill.gradient.kind === 'linear' && <NumberField label="זווית" value={fill.gradient.angle} min={-180} max={360} unit="°" onChange={(v) => setGrad({ angle: v })} />}
          {stops.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <ColorField
                label={`עצירה ${i + 1}`}
                showHex={false}
                value={s.color}
                onChange={(c) => setGrad({ stops: stops.map((x, k) => (k === i ? { ...x, color: c } : x)) }, `stop:${layer.id}:${i}`)}
              />
              <NumberField
                compact
                className="flex-1"
                label="מיקום"
                value={Math.round(s.offset * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={(v) => setGrad({ stops: stops.map((x, k) => (k === i ? { ...x, offset: v / 100 } : x)) })}
              />
              <button
                type="button"
                className="btn-ghost h-8 px-1.5"
                aria-label="הסרת עצירה"
                disabled={stops.length <= 2}
                onClick={() => setGrad({ stops: stops.filter((_, k) => k !== i) })}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-outline w-full text-xs"
            onClick={() => setGrad({ stops: [...stops, { offset: 1, color: stops[stops.length - 1]?.color ?? '#ffffff' }] })}
          >
            <Plus size={13} /> הוספת עצירה
          </button>
        </div>
      )}
      <OpacityRow label="שקיפות" value={layer.opacity} onChange={(v) => set({ opacity: v })} />
    </Section>
  );
}

function OpacityRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <NumberField className="w-40 shrink-0" label={label} value={value} min={0} max={100} unit="%" onChange={onChange} />
      <input type="range" dir="ltr" min={0} max={100} value={value} aria-label={label} className="min-w-0 flex-1" onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function EffectsSection({ layer, set }: SP) {
  const sub = 'space-y-2 border-s-2 border-accent/20 ps-3';
  return (
    <Section value="effects" title="אפקטים">
      <div className="text-xs font-semibold text-ink">קו מתאר</div>
      <div className={sub}>
        <Row label="צבע">
          <ColorField label="צבע קו מתאר" value={layer.stroke.color} onChange={(c) => set({ stroke: { ...layer.stroke, color: c } }, `stroke:${layer.id}`)} />
        </Row>
        <NumberField label="עובי" value={layer.stroke.width} min={0} max={30} step={0.5} precision={1} unit="px" onChange={(v) => set({ stroke: { ...layer.stroke, width: v } })} />
      </div>

      <Toggle label="צל" checked={layer.shadow.enabled} onChange={(v) => set({ shadow: { ...layer.shadow, enabled: v } })}>
        <span className="text-xs font-semibold text-ink">צל</span>
      </Toggle>
      {layer.shadow.enabled && (
        <div className={sub}>
          <Row label="צבע">
            <ColorField label="צבע צל" value={layer.shadow.color} onChange={(c) => set({ shadow: { ...layer.shadow, color: c } }, `shadow:${layer.id}`)} />
          </Row>
          <NumberField label="שקיפות" value={layer.shadow.opacity} min={0} max={100} unit="%" onChange={(v) => set({ shadow: { ...layer.shadow, opacity: v } })} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField compact label="אופקי" value={layer.shadow.x} min={-100} max={100} unit="px" onChange={(v) => set({ shadow: { ...layer.shadow, x: v } })} />
            <NumberField compact label="אנכי" value={layer.shadow.y} min={-100} max={100} unit="px" onChange={(v) => set({ shadow: { ...layer.shadow, y: v } })} />
          </div>
          <NumberField label="טשטוש" value={layer.shadow.blur} min={0} max={60} unit="px" onChange={(v) => set({ shadow: { ...layer.shadow, blur: v } })} />
        </div>
      )}

      <Toggle label="זוהר חיצוני" checked={layer.glow.enabled} onChange={(v) => set({ glow: { ...layer.glow, enabled: v } })}>
        <span className="text-xs font-semibold text-ink">זוהר חיצוני</span>
      </Toggle>
      {layer.glow.enabled && (
        <div className={sub}>
          <Row label="צבע">
            <ColorField label="צבע זוהר" value={layer.glow.color} onChange={(c) => set({ glow: { ...layer.glow, color: c } }, `glow:${layer.id}`)} />
          </Row>
          <NumberField label="גודל" value={layer.glow.blur} min={0} max={80} unit="px" onChange={(v) => set({ glow: { ...layer.glow, blur: v } })} />
          <NumberField label="עוצמה" value={layer.glow.strength} min={1} max={5} onChange={(v) => set({ glow: { ...layer.glow, strength: v } })} />
        </div>
      )}

      <Toggle label="תיבת רקע" checked={layer.background.enabled} onChange={(v) => set({ background: { ...layer.background, enabled: v } })}>
        <span className="text-xs font-semibold text-ink">תיבת רקע</span>
      </Toggle>
      {layer.background.enabled && (
        <div className={sub}>
          <Row label="צבע">
            <ColorField label="צבע רקע" value={layer.background.color} onChange={(c) => set({ background: { ...layer.background, color: c } }, `bg:${layer.id}`)} />
          </Row>
          <NumberField label="אטימות" value={layer.background.opacity} min={0} max={100} unit="%" onChange={(v) => set({ background: { ...layer.background, opacity: v } })} />
          <NumberField label="ריפוד" value={layer.background.padding} min={0} max={200} unit="px" onChange={(v) => set({ background: { ...layer.background, padding: v } })} />
          <NumberField label="פינות" value={layer.background.radius} min={0} max={999} unit="px" onChange={(v) => set({ background: { ...layer.background, radius: v } })} />
        </div>
      )}
    </Section>
  );
}

const ANCHORS: Anchor[] = ['tr', 'tc', 'tl', 'mr', 'mc', 'ml', 'br', 'bc', 'bl'];
const ANCHOR_NAMES: Record<Anchor, string> = {
  tl: 'למעלה משמאל',
  tc: 'למעלה במרכז',
  tr: 'למעלה מימין',
  ml: 'באמצע משמאל',
  mc: 'במרכז',
  mr: 'באמצע מימין',
  bl: 'למטה משמאל',
  bc: 'למטה במרכז',
  br: 'למטה מימין'
};

export function safeMargin(w: number, h: number) {
  return Math.round(Math.min(w, h) * 0.05);
}

function PositionSection({ layer, set }: SP) {
  const source = useEditor((s) => s.source);
  const showSafe = useEditor((s) => s.showSafe);
  const jump = (a: Anchor) => {
    if (!source) return;
    const p = anchorPoint(a, source.width, source.height, edgeInset(layer, source.width, source.height));
    set({ anchor: a, ...p }, `anchor:${layer.id}:${Date.now()}`);
  };
  return (
    <Section value="position" title="מיקום">
      <div className="flex gap-3">
        <div className="grid shrink-0 grid-cols-3 gap-1 rounded-md border border-line bg-canvas p-1.5" role="group" aria-label="עיגון">
          {ANCHORS.map((a) => (
            <button
              key={a}
              type="button"
              title={ANCHOR_NAMES[a]}
              aria-label={`עיגון ${ANCHOR_NAMES[a]}`}
              aria-pressed={layer.anchor === a}
              onClick={() => jump(a)}
              className={`focus-ring h-6 w-6 rounded-sm border ${layer.anchor === a ? 'border-accent bg-accent' : 'border-line bg-white hover:border-accent'}`}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <NumberField compact label="X" value={Math.round(layer.x)} onChange={(v) => set({ x: v })} unit="px" />
          <NumberField compact label="Y" value={Math.round(layer.y)} onChange={(v) => set({ y: v })} unit="px" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NumberField className="w-40 shrink-0" label="סיבוב" value={layer.rotation} min={-180} max={180} step={1} unit="°" onChange={(v) => set({ rotation: v })} />
        <input type="range" dir="ltr" min={-180} max={180} value={layer.rotation} aria-label="סיבוב" className="min-w-0 flex-1" onChange={(e) => set({ rotation: Number(e.target.value) })} />
      </div>
      <p className="text-[11px] text-ink-faint">בסיבוב עם הידית, החזיקו Shift להצמדה לכל 15 מעלות.</p>
      <Toggle label="הצגת שוליים בטוחים" checked={showSafe} onChange={(v) => useEditor.setState({ showSafe: v })} />
    </Section>
  );
}

function StylesSection({ layer }: { layer: TextLayer }) {
  const saved = useEditor((s) => s.savedStyles);
  const source = useEditor((s) => s.source);
  const [name, setName] = useState('');
  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t || !source) return;
    const style = t.style(source.width, source.height);
    const place = templatePlacement(t, style, source.width, source.height);
    updateLayer(layer.id, (l) => Object.assign(l, style, place), `style:${layer.id}:${Date.now()}`);
  };
  return (
    <Section value="styles" title="תבניות וסגנונות">
      <div className="grid grid-cols-2 gap-1.5">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="btn-outline text-xs" onClick={() => applyTemplate(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      {saved.length > 0 && (
        <div className="space-y-1">
          <div className="label">הסגנונות שלי</div>
          {saved.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <button type="button" className="btn-outline flex-1 justify-start truncate text-xs" onClick={() => applyStyleToLayer(layer.id, s.style)}>
                {s.name}
              </button>
              <button type="button" className="btn-ghost h-8 px-1.5" aria-label={`מחיקת הסגנון ${s.name}`} onClick={() => deleteStyle(s.id)}>
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim() || `סגנון ${saved.length + 1}`;
          void saveStyle(n, pickStyle(layer));
          setName('');
        }}
      >
        <input className="field" placeholder="שם לסגנון" value={name} onChange={(e) => setName(e.target.value)} aria-label="שם לסגנון" />
        <button type="submit" className="btn-accent shrink-0 text-xs">
          שמירת סגנון
        </button>
      </form>
    </Section>
  );
}
