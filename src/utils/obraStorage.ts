import { ObraProject, PartRecord } from '../types';
import { isIgnoredDiameter } from './csvParser';

const DB_NAME = 'CinterPortalOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'obras_store';

export function getPortalStoragePrefix(): string {
  if (typeof window === 'undefined') return 'cinter_default';
  try {
    const path = window.location.pathname || 'default';
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = ((hash << 5) - hash) + path.charCodeAt(i);
      hash |= 0;
    }
    return `cinter_portal_${Math.abs(hash)}`;
  } catch {
    return 'cinter_portal_fallback';
  }
}

function getLegacyStoragePrefix(): string {
  if (typeof window === 'undefined') return 'cinter_default';
  try {
    const path = window.location.pathname || 'default';
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = ((hash << 5) - hash) + path.charCodeAt(i);
      hash |= 0;
    }
    return `cinter_obra_${Math.abs(hash)}`;
  } catch {
    return 'cinter_obra_fallback';
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function migrateLegacySingleObra(): ObraProject | null {
  try {
    const legacyPrefix = getLegacyStoragePrefix();
    const rawParts = localStorage.getItem(`${legacyPrefix}_parts`);
    if (!rawParts) return null;
    const parsedParts: PartRecord[] = JSON.parse(rawParts);
    if (!Array.isArray(parsedParts) || parsedParts.length === 0) return null;

    const projectName = localStorage.getItem(`${legacyPrefix}_project_name`) || 'Obra Guardada';
    const rawMeta = localStorage.getItem(`${legacyPrefix}_metadata`);
    const headerMetadata: string[] = rawMeta ? JSON.parse(rawMeta) : [];
    const rawCsvText = localStorage.getItem(`${legacyPrefix}_raw_csv`) || '';
    const rawFiles = localStorage.getItem(`${legacyPrefix}_loaded_files`);
    const loadedFiles: string[] = rawFiles ? JSON.parse(rawFiles) : [];

    return {
      id: `obra-migrated-${Date.now()}`,
      name: projectName,
      parts: parsedParts,
      headerMetadata,
      rawCsvText,
      loadedFiles,
      updatedAt: new Date().toISOString(),
      sourceType: 'manual',
    };
  } catch {
    return null;
  }
}

function sanitizeLoadedObras(obras: ObraProject[]): ObraProject[] {
  return obras.map(obra => ({
    ...obra,
    parts: (obra.parts || []).map(part => {
      const filteredHoles = (part.holes || []).filter(h => !isIgnoredDiameter(h.diameter));
      if (filteredHoles.length === (part.holes || []).length) return part;
      const totalHolesPerPiece = filteredHoles.reduce((sum, h) => sum + h.countPerPiece, 0);
      return {
        ...part,
        holes: filteredHoles,
        totalHolesPerPiece,
        totalHolesAllPieces: totalHolesPerPiece * part.quantity,
      };
    }),
  }));
}

export async function loadObrasFromStorage(storagePrefix: string): Promise<ObraProject[]> {
  const storageKey = `${storagePrefix}_obras_v1`;

  try {
    const db = await openDatabase();
    const result = await new Promise<ObraProject[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(storageKey);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (Array.isArray(result)) {
      return sanitizeLoadedObras(result);
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return sanitizeLoadedObras(parsed);
    }
  } catch {
    // Ignore parse error
  }

  // Check if there is legacy single-obra data to migrate automatically
  const migrated = migrateLegacySingleObra();
  if (migrated) {
    const sanitized = sanitizeLoadedObras([migrated]);
    await saveObrasToStorage(storagePrefix, sanitized);
    return sanitized;
  }

  return [];
}

export async function saveObrasToStorage(storagePrefix: string, obras: ObraProject[]): Promise<void> {
  const storageKey = `${storagePrefix}_obras_v1`;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(obras, storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage (strip rawCsvText if needed to fit quota)
    try {
      localStorage.setItem(storageKey, JSON.stringify(obras));
    } catch {
      try {
        const compact = obras.map(o => ({ ...o, rawCsvText: '' }));
        localStorage.setItem(storageKey, JSON.stringify(compact));
      } catch (err) {
        console.error('Error saving obras to fallback localStorage', err);
      }
    }
  }
}

export function loadLastFolderSyncAt(storagePrefix: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`${storagePrefix}_last_folder_sync_at`);
  } catch {
    return null;
  }
}

export function saveLastFolderSyncAt(storagePrefix: string, isoTimestamp: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${storagePrefix}_last_folder_sync_at`, isoTimestamp);
  } catch {
    // Ignore storage quota errors
  }
}
