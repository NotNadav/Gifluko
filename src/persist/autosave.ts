import { del, get, set } from 'idb-keyval';
import type { CustomFont, Doc } from '../model/types';
import { normalizeDoc } from './projectFile';

export interface RecentEntry {
  id: string;
  name: string;
  updatedAt: number;
  thumb: string;
  width: number;
  height: number;
  frames: number;
}

export interface StoredProject {
  id: string;
  fileName: string;
  mime: string;
  fileSize: number;
  doc: Doc;
  customFonts: CustomFont[];
}

const K = {
  index: 'gcs:index',
  current: 'gcs:current',
  project: (id: string) => `gcs:p:${id}`,
  blob: (id: string) => `gcs:b:${id}`
};

const MAX_RECENT = 12;

export async function listRecent(): Promise<RecentEntry[]> {
  try {
    return ((await get(K.index)) as RecentEntry[] | undefined) ?? [];
  } catch {
    return [];
  }
}

export async function saveBlob(id: string, blob: Blob) {
  await set(K.blob(id), blob);
}

export async function saveProject(p: StoredProject, entry: RecentEntry) {
  await set(K.project(p.id), p);
  const list = (await listRecent()).filter((e) => e.id !== p.id);
  list.unshift(entry);
  const removed = list.splice(MAX_RECENT);
  await set(K.index, list);
  await set(K.current, p.id);
  for (const r of removed) await deleteProject(r.id, false);
}

export async function loadProject(id: string): Promise<{ project: StoredProject; blob: Blob } | null> {
  const [project, blob] = await Promise.all([get(K.project(id)) as Promise<StoredProject | undefined>, get(K.blob(id)) as Promise<Blob | undefined>]);
  if (!project || !blob) return null;
  return { project: { ...project, doc: normalizeDoc(project.doc), customFonts: project.customFonts ?? [] }, blob };
}

export async function deleteProject(id: string, updateIndex = true) {
  await Promise.all([del(K.project(id)), del(K.blob(id))]);
  if (updateIndex) await set(K.index, (await listRecent()).filter((e) => e.id !== id));
  if ((await get(K.current)) === id) await del(K.current);
}

export async function getCurrentId(): Promise<string | null> {
  try {
    return ((await get(K.current)) as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearCurrent() {
  await del(K.current).catch(() => undefined);
}

