import type { CustomFont, Doc } from '../model/types';
import { closeProject, setSource, toast, useEditor, bumpFonts } from '../store/editor';
import { loadErrorMessage, LoadError, loadSource, MANY_FRAMES } from '../decode/load';
import { isProjectFile, parseProjectFile, serializeProject } from '../persist/projectFile';
import { clearCurrent, deleteProject, getCurrentId, loadProject, saveBlob, saveProject } from '../persist/autosave';
import { ensureFont, isFontAvailable, onFontsChanged, registerCustomFont, registerLocalPlaceholder } from '../fonts/registry';
import { uid } from '../model/defaults';
import { baseName, downloadBlob } from '../export/exporter';
import { composeFrame, createOverlayCanvas } from '../render/drawLayer';

const setState = useEditor.setState;
const getState = useEditor.getState;

async function registerFonts(fonts: CustomFont[]) {
  for (const f of fonts) {
    try {
      await registerCustomFont(f.family, f.data);
    } catch {
      /* ignore */
    }
  }
}

function computeMissing(doc: Doc) {
  const missing: string[] = [];
  for (const l of doc.layers) {
    if (l.fontFamily.startsWith('local:')) registerLocalPlaceholder(l.fontFamily);
    if (!missing.includes(l.fontFamily) && !isFontAvailable(l.fontFamily)) missing.push(l.fontFamily);
  }
  return missing;
}

export async function startProject(blob: Blob, fileName: string, doc: Doc | null, customFonts: CustomFont[], projectId?: string) {
  setState({ loading: { label: 'טוען את הקובץ…', progress: 0 } });
  try {
    await registerFonts(customFonts);
    const source = await loadSource(blob, fileName, (p) => setState({ loading: { label: 'מפענח ריגושים…', progress: p } }));
    const id = projectId ?? uid();
    setSource(source, doc, id);
    const missing = doc ? computeMissing(doc) : [];
    setState({ customFonts, missingFonts: missing });
    if (missing.length) toast('חלק מהפונטים בפרויקט לא נמצאו. הוחלפו זמנית ב־Heebo. אפשר לטעון אותם מלוח ההגדרות.', 'warn', undefined, 10000);
    if (source.frameCount > MANY_FRAMES) toast(`בקובץ ${source.frameCount} פריימים. מומלץ להקטין ממדים בייצוא.`, 'warn', undefined, 10000);
    if (!projectId) {
      try {
        await saveBlob(id, source.blob);
      } catch {
        storageFailed();
      }
    }
    for (const l of getState().doc.layers) ensureFont(l.fontFamily, l.fontWeight, l.italic, l.text).catch(() => undefined);
    void autosaveNow();
  } catch (e) {
    const code = e instanceof LoadError ? e.code : 'bad-file';
    toast(loadErrorMessage(code), 'error', undefined, 10000);
  } finally {
    setState({ loading: null });
  }
}

export async function openFile(file: File) {
  if (isProjectFile(file)) {
    try {
      const p = await parseProjectFile(file);
      await startProject(p.blob, p.fileName, p.doc, p.customFonts);
    } catch {
      toast('קובץ הפרויקט פגום או לא נתמך.', 'error');
    }
    return;
  }
  await startProject(file, file.name || 'clipboard.gif', null, []);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export async function openRecent(id: string) {
  const data = await loadProject(id).catch(() => null);
  if (!data) {
    toast('הפרויקט לא נמצא באחסון של הדפדפן.', 'error');
    await deleteProject(id).catch(() => undefined);
    return false;
  }
  await startProject(data.blob, data.project.fileName, data.project.doc, data.project.customFonts, id);
  return true;
}

export async function restoreLast() {
  const id = await getCurrentId();
  if (!id) return;
  await openRecent(id);
}

export async function closeCurrent() {
  await autosaveNow();
  closeProject();
  await clearCurrent();
}

async function thumbnail(): Promise<string> {
  const s = getState();
  if (!s.source) return '';
  try {
    const overlay = createOverlayCanvas(s.doc.layers, s.source.width, s.source.height, { missing: new Set(s.missingFonts) });
    const scale = Math.min(1, 200 / Math.max(s.source.width, s.source.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(s.source.width * scale));
    c.height = Math.max(1, Math.round(s.source.height * scale));
    composeFrame(c.getContext('2d')!, s.source.frames[0], overlay, c.width, c.height, '#ffffff');
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  }
}

let storageWarned = false;
function storageFailed() {
  if (storageWarned) return;
  storageWarned = true;
  toast('השמירה האוטומטית נכשלה (ייתכן שהאחסון של הדפדפן מלא). מומלץ להוריד קובץ פרויקט.', 'error', { label: 'הורדת קובץ פרויקט', run: () => void downloadProject() }, 0);
}

export async function autosaveNow() {
  const s = getState();
  if (!s.source || !s.projectId) return;
  try {
    await saveProject(
      { id: s.projectId, fileName: s.source.fileName, mime: s.source.mime, fileSize: s.source.fileSize, doc: s.doc, customFonts: s.customFonts },
      {
        id: s.projectId,
        name: s.source.fileName,
        updatedAt: Date.now(),
        thumb: await thumbnail(),
        width: s.source.width,
        height: s.source.height,
        frames: s.source.frameCount
      }
    );
    storageWarned = false;
  } catch {
    storageFailed();
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function initAutosave() {
  useEditor.subscribe((s, prev) => {
    if (!s.source || (s.doc === prev.doc && s.customFonts === prev.customFonts)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void autosaveNow(), 1000);
  });
  onFontsChanged(() => bumpFonts());
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.addEventListener('loadingdone', () => bumpFonts());
  }
  window.addEventListener('pagehide', () => void autosaveNow());
  window.addEventListener('beforeunload', (e) => {
    if (getState().source) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

export async function downloadProject() {
  const s = getState();
  if (!s.source) return;
  const blob = await serializeProject({ fileName: s.source.fileName, mime: s.source.mime, blob: s.source.blob, doc: s.doc, customFonts: s.customFonts });
  downloadBlob(blob, `${baseName(s.source.fileName)}.gifcaption.json`);
}

export async function uploadFontFile(file: File, replaceId?: string) {
  const { fontFileFamily } = await import('../fonts/registry');
  try {
    const data = await file.arrayBuffer();
    const family = replaceId?.startsWith('custom:') ? replaceId.slice(7) : replaceId?.startsWith('local:') ? replaceId.slice(6) : fontFileFamily(file.name);
    const def = await registerCustomFont(family, data);
    const font: CustomFont = { family, fileName: file.name, data };
    const s = getState();
    const missing = s.missingFonts.filter((m) => m !== replaceId && m !== def.id);
    setState({ customFonts: [...s.customFonts.filter((f) => f.family !== family), font], missingFonts: missing });
    if (replaceId && replaceId !== def.id) {
      const { commit } = await import('../store/editor');
      commit((doc) => doc.layers.forEach((l) => l.fontFamily === replaceId && (l.fontFamily = def.id)));
    }
    toast(`הפונט "${family}" נטען.`, 'info');
    return def;
  } catch {
    toast('לא הצלחנו לטעון את קובץ הפונט.', 'error');
    return null;
  }
}

