// Bezpečnost dat: trvalé úložiště prohlížeče, evidence záloh a průběžné ukládání do souboru.
//
// Data aplikace leží v úložišti prohlížeče (IndexedDB) a přežijí zavření karty i restart
// počítače. Ztratit je lze smazáním dat prohlížeče, proto aplikace
// 1. žádá prohlížeč o trvalé úložiště (aby je nesmazal sám při nedostatku místa),
// 2. eviduje, kdy byla naposledy stažena záloha,
// 3. v prohlížečích, které to umějí (Chrome, Edge, Opera), ukládá projekt průběžně
//    do souboru na disku – ten může ležet i ve složce synchronizované s cloudem.

import { db, exportBackup, getSetting, setSetting } from './db';
import { nowIso } from './util';

// ---- Trvalé úložiště ------------------------------------------------------------

export interface StorageStatus {
  /** true = prohlížeč data sám nesmaže; null = prohlížeč stav nesděluje. */
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
}

/** Požádá prohlížeč, aby data aplikace nemazal při nedostatku místa. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageStatus(): Promise<StorageStatus> {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    return { persisted, usage: est?.usage ?? null, quota: est?.quota ?? null };
  } catch {
    return { persisted: null, usage: null, quota: null };
  }
}

// ---- Evidence záloh ---------------------------------------------------------------

const backupKey = (projectId: string) => `backup:${projectId}`;

export const markBackup = (projectId: string) => setSetting(backupKey(projectId), nowIso());
export const lastBackup = (projectId: string) => getSetting(backupKey(projectId));

/** „dnes 14:05“, „včera“, „před 5 dny“ – pro stav zálohy v postranním panelu. */
export function ago(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (days <= 0) return `dnes ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (days === 1) return 'včera';
  return `před ${days} dny`;
}

// ---- Průběžné ukládání do souboru (File System Access API) ------------------------

interface FileHandle {
  name: string;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'readwrite' }): Promise<PermissionState>;
}

type Picker = (opts: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileHandle>;

const picker = (): Picker | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker);

/** Umí tento prohlížeč zapisovat do souboru zvoleného uživatelem? */
export const fileSaveSupported = () => !!picker();

const handleKey = (projectId: string) => `file:${projectId}`;

async function getHandle(projectId: string): Promise<FileHandle | null> {
  return ((await db.handles.get(handleKey(projectId)))?.handle as FileHandle | undefined) ?? null;
}

export interface LinkedFile {
  name: string;
  /** granted = lze zapisovat; prompt = po novém otevření prohlížeče je potřeba zápis znovu povolit. */
  permission: PermissionState;
}

export async function linkedFile(projectId: string): Promise<LinkedFile | null> {
  const handle = await getHandle(projectId);
  if (!handle) return null;
  let permission: PermissionState = 'granted';
  try {
    if (handle.queryPermission) permission = await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    permission = 'prompt';
  }
  return { name: handle.name, permission };
}

/** Nechá uživatele zvolit soubor a hned do něj projekt uloží. Vrací název souboru, nebo null při zrušení. */
export async function linkFile(projectId: string, suggestedName: string): Promise<string | null> {
  const pick = picker();
  if (!pick) throw new Error('Tento prohlížeč průběžné ukládání do souboru nepodporuje.');
  let handle: FileHandle;
  try {
    handle = await pick({ suggestedName, types: [{ description: 'Projekt aplikace Průvodce přehledem', accept: { 'application/json': ['.json'] } }] });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
  await db.handles.put({ key: handleKey(projectId), handle });
  await saveToFile(projectId);
  return handle.name;
}

export async function unlinkFile(projectId: string): Promise<void> {
  await db.handles.delete(handleKey(projectId));
}

/** Po novém spuštění prohlížeče požádá o povolení zápisu (musí být vyvoláno kliknutím). */
export async function regrantFile(projectId: string): Promise<boolean> {
  const handle = await getHandle(projectId);
  if (!handle?.requestPermission) return !!handle;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

export type SaveResult = 'saved' | 'no-link' | 'no-permission' | 'error';

/** Zapíše aktuální stav projektu do propojeného souboru. */
export async function saveToFile(projectId: string): Promise<SaveResult> {
  const handle = await getHandle(projectId);
  if (!handle) return 'no-link';
  try {
    if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') return 'no-permission';
    const data = JSON.stringify(await exportBackup(projectId));
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    await markBackup(projectId);
    return 'saved';
  } catch {
    return 'error';
  }
}
