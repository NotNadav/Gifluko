import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, TriangleExclamationPoint, X } from 'lucide-react';
import { toast, updateExport, useEditor } from '../store/editor';
import type { ExportSettings } from '../model/types';
import { downloadBlob, estimateGifSize, ExportCancelled, formatBytes, frameSelection, outputName, outputSize, runExport } from '../export/exporter';
import { NumberField } from './controls/NumberField';
import { Row, Segmented, SelectField, Toggle } from './controls/basic';

const LARGE_BYTES = 8 * 1024 * 1024;

export function ExportDialog() {
  const open = useEditor((s) => s.exportOpen);
  const source = useEditor((s) => s.source);
  const settings = useEditor((s) => s.doc.exportSettings);
  const layers = useEditor((s) => s.doc.layers);
  const missing = useEditor((s) => s.missingFonts);
  const frame = useEditor((s) => s.frame);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setEstimate(null), [settings, layers]);
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  if (!source) return null;
  const set = (patch: Partial<ExportSettings>) => updateExport(patch);
  const { w, h } = outputSize(source, settings);
  const isGif = settings.format === 'gif';
  const animatedFormat = settings.format !== 'png';
  const frames = frameSelection(source.delays, settings.frameStep).indices.length;
  const effectsOnAlpha =
    source.hasAlpha && isGif && layers.some((l) => l.visible && (l.stroke.width > 0 || l.shadow.enabled || l.glow.enabled));

  const job = (s: ExportSettings, signal?: AbortSignal) => ({
    source,
    layers,
    settings: s,
    missing: new Set(missing),
    signal,
    onProgress: (p: number, l: string) => {
      setProgress(p);
      setLabel(l);
    }
  });

  const doEstimate = async (s = settings) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setEstimating(true);
    try {
      const bytes = await estimateGifSize(job(s, ctrl.signal));
      if (s === settings) setEstimate(bytes);
      return bytes;
    } catch {
      return null;
    } finally {
      setEstimating(false);
    }
  };

  const autoFit = async () => {
    const target = settings.targetSizeKB * 1024;
    if (!target) return;
    setEstimating(true);
    let s = { ...settings };
    let est = await doEstimate(s);
    const colorSteps = [128, 64, 32, 16].filter((c) => c < s.colors);
    for (const c of colorSteps) {
      if (est == null || est <= target) break;
      s = { ...s, colors: c };
      est = await doEstimate(s);
    }
    while (est != null && est > target && s.scale > 15) {
      s = { ...s, scale: Math.max(10, Math.round(s.scale * Math.sqrt(target / est) * 0.95)) };
      est = await doEstimate(s);
    }
    setEstimating(false);
    if (est == null) return;
    updateExport({ colors: s.colors, scale: s.scale });
    setTimeout(() => setEstimate(est), 0);
    toast(est <= target ? `ההגדרות עודכנו: ${s.colors} צבעים, ${s.scale}% גודל.` : 'לא הצלחנו להגיע לגודל היעד. נסו לדלג על פריימים.', est <= target ? 'info' : 'warn');
  };

  const doExport = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setProgress(0);
    setLabel('מכין…');
    const t0 = performance.now();
    try {
      const blob = await runExport(job(settings, ctrl.signal), frame);
      const name = outputName(source.fileName, settings.format);
      downloadBlob(blob, name);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      toast(`הקובץ ${name} ירד (${formatBytes(blob.size)}, ${secs} שניות).`);
      useEditor.setState({ exportOpen: false });
    } catch (e) {
      if (!(e instanceof ExportCancelled)) toast('הייצוא נכשל. נסו שוב, או בחרו פורמט אחר.', 'error');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const tooLarge = estimate != null && estimate > LARGE_BYTES;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !running && useEditor.setState({ exportOpen: v })}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          dir="rtl"
          onEscapeKeyDown={(e) => running && e.preventDefault()}
          onPointerDownOutside={(e) => running && e.preventDefault()}
          className="scroll-thin fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-24px)] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 text-ink shadow-2xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">ייצוא</Dialog.Title>
            <Dialog.Close className="btn-ghost px-1.5" aria-label="סגירה" disabled={running}>
              <X size={16} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">הגדרות ייצוא הקובץ</Dialog.Description>

          <fieldset disabled={running} className="space-y-3">
            <Row label="פורמט">
              <Segmented
                label="פורמט"
                value={settings.format}
                onChange={(v) => set({ format: v })}
                options={[
                  { value: 'gif', label: 'GIF' },
                  { value: 'webp', label: 'WebP' },
                  { value: 'mp4', label: 'MP4' },
                  { value: 'png', label: 'PNG', title: 'תמונה סטטית של הפריים הנוכחי' }
                ]}
              />
            </Row>
            {settings.format === 'png' && <p className="text-xs text-ink-soft">ייצוא של הפריים הנוכחי ({frame + 1}) כתמונה.</p>}
            {(settings.format === 'mp4' || settings.format === 'webp') && (
              <p className="text-xs text-ink-soft">מנוע הווידאו נטען בפעם הראשונה (כ־30MB), ואחר כך נשמר בדפדפן.{settings.format === 'mp4' && source.hasAlpha ? ' לסרטון אין שקיפות, הרקע יהיה לבן.' : ''}</p>
            )}

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <NumberField
                compact
                label="רוחב"
                unit="px"
                value={w}
                min={1}
                max={source.width * 4}
                onChange={(v) => set({ scale: Math.max(1, Math.min(400, Math.round((v / source.width) * 1000) / 10)) })}
              />
              <span className="text-ink-faint">×</span>
              <NumberField
                compact
                label="גובה"
                unit="px"
                value={h}
                min={1}
                max={source.height * 4}
                onChange={(v) => set({ scale: Math.max(1, Math.min(400, Math.round((v / source.height) * 1000) / 10)) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <NumberField className="w-40 shrink-0" label="גודל" unit="%" value={settings.scale} min={1} max={400} step={1} precision={1} onChange={(v) => set({ scale: v })} />
              <input type="range" dir="ltr" min={10} max={200} value={Math.min(200, settings.scale)} aria-label="גודל באחוזים" className="min-w-0 flex-1" onChange={(e) => set({ scale: Number(e.target.value) })} />
            </div>

            {isGif && (
              <>
                <div className="flex items-center gap-2">
                  <NumberField className="w-40 shrink-0" label="צבעים" value={settings.colors} min={2} max={256} onChange={(v) => set({ colors: v })} />
                  <input type="range" dir="ltr" min={2} max={256} value={settings.colors} aria-label="מספר צבעים" className="min-w-0 flex-1" onChange={(e) => set({ colors: Number(e.target.value) })} />
                </div>
                <Row label="פיזור צבע">
                  <SelectField
                    label="שיטת פיזור צבע"
                    value={settings.dither}
                    onChange={(v) => set({ dither: v })}
                    options={[
                      { value: 'none', label: 'ללא (הקובץ הקטן ביותר)' },
                      { value: 'floyd', label: 'Floyd–Steinberg (מעברים חלקים)' },
                      { value: 'bayer4', label: 'Bayer 4×4 (דפוס סדור)' },
                      { value: 'bayer8', label: 'Bayer 8×8 (דפוס סדור עדין)' }
                    ]}
                  />
                </Row>
                <Toggle label="אופטימיזציה" checked={settings.optimize} onChange={(v) => set({ optimize: v })}>
                  שמירת אזורים שלא השתנו בין פריימים (קובץ קטן יותר)
                </Toggle>
              </>
            )}
            {(settings.format === 'webp' || settings.format === 'mp4') && (
              <div className="flex items-center gap-2">
                <NumberField className="w-40 shrink-0" label="איכות" value={settings.quality} min={1} max={100} onChange={(v) => set({ quality: v })} />
                <input type="range" dir="ltr" min={1} max={100} value={settings.quality} aria-label="איכות" className="min-w-0 flex-1" onChange={(e) => set({ quality: Number(e.target.value) })} />
              </div>
            )}

            {animatedFormat && source.frameCount > 1 && (
              <>
                {settings.format !== 'mp4' && (
                  <Row label="לולאה">
                    <div className="flex items-center gap-2">
                      <Segmented
                        label="לולאה"
                        value={settings.loop}
                        onChange={(v) => set({ loop: v })}
                        options={[
                          { value: 'source', label: 'כמו המקור' },
                          { value: 'forever', label: 'אינסופית' },
                          { value: 'count', label: 'מספר' }
                        ]}
                      />
                    </div>
                  </Row>
                )}
                {settings.loop === 'count' && settings.format !== 'mp4' && (
                  <NumberField label="פעמים" value={settings.loopTimes} min={1} max={1000} onChange={(v) => set({ loopTimes: v })} />
                )}
                <Row label="פריימים">
                  <SelectField
                    label="דילוג על פריימים"
                    value={settings.frameStep}
                    onChange={(v) => set({ frameStep: v })}
                    options={[
                      { value: 1, label: `כל הפריימים (${source.frameCount})` },
                      { value: 2, label: `כל פריים שני (${Math.ceil(source.frameCount / 2)})` },
                      { value: 3, label: `כל פריים שלישי (${Math.ceil(source.frameCount / 3)})` },
                      { value: 4, label: `כל פריים רביעי (${Math.ceil(source.frameCount / 4)})` }
                    ]}
                  />
                </Row>
              </>
            )}

            {isGif && (
              <div className="space-y-2 rounded-lg bg-canvas p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-soft">גודל משוער</span>
                  <span className="font-semibold tabular-nums">{estimating ? 'מחשב…' : estimate != null ? `~${formatBytes(estimate)}` : '—'}</span>
                  <button type="button" className="btn-outline px-2 text-xs" onClick={() => void doEstimate()} disabled={estimating}>
                    חישוב
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <NumberField className="min-w-0 flex-1" label="גודל יעד" unit="KB" value={settings.targetSizeKB} min={0} max={100000} onChange={(v) => set({ targetSizeKB: v })} />
                  <button type="button" className="btn-outline shrink-0 px-2 text-xs" disabled={!settings.targetSizeKB || estimating} onClick={autoFit}>
                    התאמה אוטומטית
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint">0 = ללא הגבלה. ההתאמה מורידה צבעים ואז ממדים עד שהקובץ קטן מהיעד.</p>
              </div>
            )}

            {effectsOnAlpha && (
              <Warn>לגיף יש רקע שקוף. בגיף אין שקיפות חלקית, ולכן קו מתאר, צל או זוהר עלולים ליצור שוליים מחוספסים מעל אזורים שקופים.</Warn>
            )}
            {tooLarge && <Warn>הקובץ צפוי להיות גדול מאוד. אפשר להקטין ממדים, להוריד את מספר הצבעים, או לדלג על פריימים.</Warn>}
          </fieldset>

          {running ? (
            <div className="mt-5 space-y-2" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-ink-soft">
                <span>{label}</span>
                <button type="button" className="btn-outline px-3 text-xs" onClick={() => abortRef.current?.abort()}>
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-xs text-ink-faint">
                {w}×{h} · {settings.format === 'png' ? 'פריים אחד' : `${frames} פריימים`}
              </span>
              <button type="button" className="btn-accent px-5" onClick={doExport} autoFocus>
                <Download size={16} /> ייצוא והורדה
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
      <TriangleExclamationPoint size={15} className="mt-0.5 shrink-0 text-amber-500" />
      <span>{children}</span>
    </div>
  );
}
