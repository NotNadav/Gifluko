import type { CustomFont, Doc } from '../model/types';
import { defaultExport, defaultStyle } from '../model/defaults';

export interface ProjectFileData {
  fileName: string;
  mime: string;
  blob: Blob;
  doc: Doc;
  customFonts: CustomFont[];
}

const APP = 'Gifluko';
const LEGACY_APPS = ['GifCaption Studio'];

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function serializeProject(p: ProjectFileData): Promise<Blob> {
  const fonts = await Promise.all(
    p.customFonts.map(async (f) => ({ family: f.family, fileName: f.fileName, data: await blobToBase64(new Blob([f.data])) }))
  );
  const json = {
    app: APP,
    version: 1,
    savedAt: new Date().toISOString(),
    source: { fileName: p.fileName, mime: p.mime, data: await blobToBase64(p.blob) },
    doc: p.doc,
    customFonts: fonts
  };
  return new Blob([JSON.stringify(json)], { type: 'application/json' });
}

export function normalizeDoc(raw: unknown): Doc {
  const d = (raw ?? {}) as Partial<Doc>;
  const base = defaultStyle();
  const layers = Array.isArray(d.layers)
    ? d.layers.map((l) => ({
        ...base,
        ...l,
        fill: { ...base.fill, ...(l.fill ?? {}), gradient: { ...base.fill.gradient, ...(l.fill?.gradient ?? {}) } },
        stroke: { ...base.stroke, ...(l.stroke ?? {}) },
        shadow: { ...base.shadow, ...(l.shadow ?? {}) },
        glow: { ...base.glow, ...(l.glow ?? {}) },
        background: { ...base.background, ...(l.background ?? {}) }
      }))
    : [];
  return { layers, exportSettings: { ...defaultExport(), ...(d.exportSettings ?? {}) } };
}

export async function parseProjectFile(file: Blob): Promise<ProjectFileData> {
  const json = JSON.parse(await file.text());
  if (!json || (json.app !== APP && !LEGACY_APPS.includes(json.app)) || !json.source?.data) throw new Error('bad-project');
  const bytes = base64ToBytes(json.source.data);
  return {
    fileName: String(json.source.fileName || 'project.gif'),
    mime: String(json.source.mime || 'image/gif'),
    blob: new Blob([bytes as BlobPart], { type: json.source.mime || 'image/gif' }),
    doc: normalizeDoc(json.doc),
    customFonts: Array.isArray(json.customFonts)
      ? json.customFonts.map((f: { family: string; fileName: string; data: string }) => ({
          family: String(f.family),
          fileName: String(f.fileName || f.family),
          data: base64ToBytes(f.data).buffer as ArrayBuffer
        }))
      : []
  };
}

export function isProjectFile(file: File) {
  return /\.json$/i.test(file.name) || file.type === 'application/json';
}
