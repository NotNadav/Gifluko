export interface FontDef {
  id: string;
  label: string;
  family: string;
  weights: number[];
  hebrew: boolean;
  description: string;
  source: 'builtin' | 'local' | 'custom';
  load?: () => Promise<unknown>;
}

const range = (a: number, b: number) => {
  const out: number[] = [];
  for (let w = a; w <= b; w += 100) out.push(w);
  return out;
};

export const BUILTIN_FONTS: FontDef[] = [
  { id: 'heebo', label: 'Heebo', family: 'Heebo Variable', weights: range(100, 900), hebrew: true, source: 'builtin', description: 'פשוט ונקי עם משקלים רבים. ברירת המחדל.', load: () => import('@fontsource-variable/heebo/index.css') },
  { id: 'assistant', label: 'Assistant', family: 'Assistant Variable', weights: range(200, 800), hebrew: true, source: 'builtin', description: 'קריא מאוד, מתאים לכתוביות.', load: () => import('@fontsource-variable/assistant/index.css') },
  { id: 'rubik', label: 'Rubik', family: 'Rubik Variable', weights: range(300, 900), hebrew: true, source: 'builtin', description: 'מעוגל ומודרני, לתגיות ולכותרות.', load: () => Promise.all([import('@fontsource-variable/rubik/index.css'), import('@fontsource-variable/rubik/wght-italic.css')]) },
  { id: 'secular-one', label: 'Secular One', family: 'Secular One', weights: [400], hebrew: true, source: 'builtin', description: 'עבה ובולט, הבחירה הטבעית למימים.', load: () => import('@fontsource/secular-one/index.css') },
  { id: 'suez-one', label: 'Suez One', family: 'Suez One', weights: [400], hebrew: true, source: 'builtin', description: 'סריף כבד לכותרות דרמטיות.', load: () => import('@fontsource/suez-one/index.css') },
  { id: 'frank-ruhl', label: 'Frank Ruhl Libre', family: 'Frank Ruhl Libre Variable', weights: range(300, 900), hebrew: true, source: 'builtin', description: 'סגנון עיתון קלאסי.', load: () => import('@fontsource-variable/frank-ruhl-libre/index.css') },
  { id: 'david-libre', label: 'David Libre', family: 'David Libre', weights: [400, 500, 700], hebrew: true, source: 'builtin', description: 'דוד הקלאסי, רשמי.', load: () => Promise.all([import('@fontsource/david-libre/400.css'), import('@fontsource/david-libre/500.css'), import('@fontsource/david-libre/700.css')]) },
  { id: 'alef', label: 'Alef', family: 'Alef', weights: [400, 700], hebrew: true, source: 'builtin', description: 'פשוט ונייטרלי.', load: () => Promise.all([import('@fontsource/alef/400.css'), import('@fontsource/alef/700.css')]) },
  { id: 'varela-round', label: 'Varela Round', family: 'Varela Round', weights: [400], hebrew: true, source: 'builtin', description: 'מעוגל ורך, ידידותי.', load: () => import('@fontsource/varela-round/index.css') },
  { id: 'karantina', label: 'Karantina', family: 'Karantina', weights: [300, 400, 700], hebrew: true, source: 'builtin', description: 'צר וגבוה, נכנס הרבה טקסט ברוחב קטן.', load: () => Promise.all([import('@fontsource/karantina/300.css'), import('@fontsource/karantina/400.css'), import('@fontsource/karantina/700.css')]) },
  { id: 'amatic-sc', label: 'Amatic SC', family: 'Amatic SC', weights: [400, 700], hebrew: true, source: 'builtin', description: 'כתב יד דק ומשחקי.', load: () => Promise.all([import('@fontsource/amatic-sc/400.css'), import('@fontsource/amatic-sc/700.css')]) },
  { id: 'noto-sans-hebrew', label: 'Noto Sans Hebrew', family: 'Noto Sans Hebrew Variable', weights: range(100, 900), hebrew: true, source: 'builtin', description: 'כיסוי מלא של ניקוד וסימנים.', load: () => import('@fontsource-variable/noto-sans-hebrew/index.css') }
];

const extra = new Map<string, FontDef>();
const loaded = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export const FALLBACK_STACK = 'sans-serif';

export function onFontsChanged(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function allFonts(): FontDef[] {
  return [...BUILTIN_FONTS, ...extra.values()];
}

export function getFont(id: string): FontDef | undefined {
  return BUILTIN_FONTS.find((f) => f.id === id) ?? extra.get(id);
}

export function cssFamily(id: string): string {
  const def = getFont(id) ?? BUILTIN_FONTS[0];
  return `"${def.family}", "${BUILTIN_FONTS[0].family}", ${FALLBACK_STACK}`;
}

export function nearestWeight(id: string, weight: number): number {
  const def = getFont(id);
  if (!def || def.weights.length === 0) return weight;
  return def.weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), def.weights[0]);
}

export function ensureFont(id: string, weight = 400, italic = false, text = 'אבגabc'): Promise<void> {
  const def = getFont(id) ?? BUILTIN_FONTS[0];
  const key = `${def.id}|${weight}|${italic}|${text}`;
  const existing = loaded.get(key);
  if (existing) return existing;
  const p = (async () => {
    if (def.load) await def.load();
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await document.fonts.load(`${italic ? 'italic ' : ''}${weight} 32px "${def.family}"`, text || 'א');
      } catch {
        /* ignore */
      }
    }
    emit();
  })();
  loaded.set(key, p);
  if (loaded.size > 2000) loaded.clear();
  return p;
}

let probe: CanvasRenderingContext2D | null = null;
function probeCtx() {
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  return probe!;
}

export function fontRenders(family: string, sample = 'אבגדהabcdeg'): boolean {
  const ctx = probeCtx();
  for (const generic of ['monospace', 'serif']) {
    ctx.font = `40px ${generic}`;
    const a = ctx.measureText(sample).width;
    ctx.font = `40px "${family}", ${generic}`;
    const b = ctx.measureText(sample).width;
    if (Math.abs(a - b) > 0.5) return true;
  }
  return false;
}

export function supportsHebrew(family: string): boolean {
  return fontRenders(family, 'אבגדהוזחטשלום');
}

export const localFontsSupported = () => typeof window !== 'undefined' && 'queryLocalFonts' in window;

interface LocalFontData {
  family: string;
  style: string;
}

export async function loadLocalFonts(): Promise<FontDef[]> {
  const q = (window as unknown as { queryLocalFonts: () => Promise<LocalFontData[]> }).queryLocalFonts;
  const list = await q();
  const families = new Map<string, Set<number>>();
  for (const f of list) {
    const s = families.get(f.family) ?? new Set<number>();
    const st = f.style.toLowerCase();
    const w = /thin|hairline/.test(st) ? 100 : /extra ?light|ultra ?light/.test(st) ? 200 : /light/.test(st) ? 300 : /medium/.test(st) ? 500 : /semi ?bold|demi/.test(st) ? 600 : /extra ?bold|ultra ?bold/.test(st) ? 800 : /black|heavy/.test(st) ? 900 : /bold/.test(st) ? 700 : 400;
    s.add(w);
    families.set(f.family, s);
  }
  const defs: FontDef[] = [];
  for (const [family, weights] of families) {
    const id = `local:${family}`;
    const def: FontDef = {
      id,
      label: family,
      family,
      weights: [...weights].sort((a, b) => a - b),
      hebrew: supportsHebrew(family),
      source: 'local',
      description: 'פונט מהמחשב'
    };
    extra.set(id, def);
    defs.push(def);
  }
  emit();
  return defs;
}

export async function registerCustomFont(family: string, data: ArrayBuffer): Promise<FontDef> {
  const face = new FontFace(family, data.slice(0));
  await face.load();
  document.fonts.add(face);
  const id = `custom:${family}`;
  const def: FontDef = {
    id,
    label: family,
    family,
    weights: [face.weight === 'normal' ? 400 : Number(face.weight) || 400],
    hebrew: supportsHebrew(family),
    source: 'custom',
    description: 'פונט שהועלה'
  };
  extra.set(id, def);
  emit();
  return def;
}

export function registerLocalPlaceholder(id: string) {
  if (!id.startsWith('local:') || extra.has(id)) return;
  const family = id.slice(6);
  extra.set(id, { id, label: family, family, weights: [400, 700], hebrew: true, source: 'local', description: 'פונט מהמחשב' });
}

export function isFontAvailable(id: string): boolean {
  const builtin = BUILTIN_FONTS.find((f) => f.id === id);
  if (builtin) return true;
  if (id.startsWith('custom:')) return extra.has(id);
  if (id.startsWith('local:')) return fontRenders(id.slice(6));
  return false;
}

export function fontFileFamily(fileName: string) {
  return fileName.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Custom Font';
}
