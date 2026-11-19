import type { MediaAsset, ProjectState } from '../types/editor';
import { deserializeProject, serializeProject } from './timelineEngine';

const DB_NAME = 'z_editz_db';
const DB_VERSION = 1;
const PROJECT_STORE = 'projects';
const MEDIA_STORE = 'mediaBlobs';
const CURRENT_PROJECT_KEY = 'autosave_project';

interface StoredMediaItem {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE);
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves the project state to IndexedDB with automatic fallback to localStorage.
 */
export async function saveProjectToStorage(project: ProjectState): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PROJECT_STORE, 'readwrite');
      const store = tx.objectStore(PROJECT_STORE);
      const req = store.put(project, CURRENT_PROJECT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem('z_editz_autosave_v1', serializeProject(project));
    } catch {
      // Quota exceeded
    }
  }
}

/**
 * Loads the autosaved project state from IndexedDB (or legacy localStorage).
 */
export async function loadProjectFromStorage(): Promise<ProjectState | null> {
  try {
    const db = await openDatabase();
    const proj = await new Promise<ProjectState | null>((resolve, reject) => {
      const tx = db.transaction(PROJECT_STORE, 'readonly');
      const store = tx.objectStore(PROJECT_STORE);
      const req = store.get(CURRENT_PROJECT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (proj && Array.isArray(proj.clips) && Array.isArray(proj.tracks)) {
      return proj;
    }
  } catch {
    // Fallback
  }

  try {
    const saved = localStorage.getItem('z_editz_autosave_v1');
    if (saved) {
      const parsed = deserializeProject(saved);
      if (parsed.clips.length > 0 && parsed.tracks.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Stores an imported File/Blob in IndexedDB so it survives browser reloads.
 */
export async function storeMediaBlob(assetId: string, file: File | Blob, name: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE);
      const item: StoredMediaItem = {
        id: assetId,
        name,
        type: file.type,
        blob: file,
        updatedAt: Date.now(),
      };
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore storage error
  }
}

/**
 * Reconstitutes Blob object URLs for user-imported assets when the app reloads.
 */
export async function restoreMediaAssetsBlobs(assets: MediaAsset[]): Promise<MediaAsset[]> {
  try {
    const db = await openDatabase();
    const items = await new Promise<StoredMediaItem[]>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const store = tx.objectStore(MEDIA_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const map = new Map(items.map((it) => [it.id, it.blob]));

    return assets.map((asset) => {
      if (asset.isBuiltin) return asset;
      const storedBlob = map.get(asset.id);
      if (storedBlob) {
        const freshUrl = URL.createObjectURL(storedBlob);
        return {
          ...asset,
          src: freshUrl,
          thumbnail: asset.type === 'image' ? freshUrl : asset.thumbnail,
        };
      }
      return asset;
    });
  } catch {
    return assets;
  }
}
