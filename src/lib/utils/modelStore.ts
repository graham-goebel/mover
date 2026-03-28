/**
 * modelStore.ts
 * IndexedDB wrapper for storing generated GLB files.
 *
 * Keys are item IDs.  Values are ArrayBuffers (binary GLB).
 * GLBs are too large for localStorage (~500 KB–2 MB each).
 *
 * Usage:
 *   await saveGlb(itemId, arrayBuffer);
 *   const url = await getBlobUrl(itemId);   // object URL, valid for this session
 *   await deleteGlb(itemId);
 */

const DB_NAME  = 'mover-models';
const STORE    = 'glbs';
const VERSION  = 1;

/** Prefix stored in InventoryItem.modelUrl to signal an IndexedDB entry */
export const IDB_PREFIX = 'idb:';

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
	if (_db) return Promise.resolve(_db);

	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);

		req.onupgradeneeded = (e) => {
			(e.target as IDBOpenDBRequest).result.createObjectStore(STORE);
		};

		req.onsuccess = (e) => {
			_db = (e.target as IDBOpenDBRequest).result;
			resolve(_db);
		};

		req.onerror = () => reject(req.error);
	});
}

export async function saveGlb(itemId: string, glb: ArrayBuffer): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(glb, itemId);
		tx.oncomplete = () => resolve();
		tx.onerror    = () => reject(tx.error);
	});
}

/** Returns an object URL (blob:) for the stored GLB, or null if not found. */
export async function getBlobUrl(itemId: string): Promise<string | null> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(itemId);
		req.onsuccess = () => {
			if (req.result instanceof ArrayBuffer) {
				const blob = new Blob([req.result], { type: 'model/gltf-binary' });
				resolve(URL.createObjectURL(blob));
			} else {
				resolve(null);
			}
		};
		req.onerror = () => reject(req.error);
	});
}

export async function deleteGlb(itemId: string): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(itemId);
		tx.oncomplete = () => resolve();
		tx.onerror    = () => reject(tx.error);
	});
}

/** True if a modelUrl value points to IndexedDB. */
export function isIdbUrl(url: string): boolean {
	return url.startsWith(IDB_PREFIX);
}

/** Extract the item ID from an idb: URL. */
export function itemIdFromIdbUrl(url: string): string {
	return url.slice(IDB_PREFIX.length);
}
