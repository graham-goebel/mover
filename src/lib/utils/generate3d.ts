/**
 * generate3d.ts
 * Orchestrator: attempt WebXR LiDAR depth first, fall back to Transformers.js.
 *
 * Pipeline:
 *   1. Check if WebXR depth-sensing is available (iOS LiDAR)
 *   2a. If yes → captureArDepth() → depthToGlb()
 *   2b. If no  → run depth.worker.ts (Transformers.js) → depthToGlb()
 *   3. Save GLB to IndexedDB via modelStore
 *   4. Set item.modelUrl = `idb:${itemId}`
 */

import { depthToGlb } from './depthMesh';
import { saveGlb, getBlobUrl, IDB_PREFIX } from './modelStore';
import { isArDepthAvailable, captureArDepth } from './arDepth';

// Shared worker instance (created lazily, reused across calls)
let _worker: Worker | null = null;

function getDepthWorker(): Worker {
	if (!_worker) {
		_worker = new Worker(
			new URL('../workers/depth.worker.ts', import.meta.url),
			{ type: 'module' }
		);
	}
	return _worker;
}

// ---------------------------------------------------------------------------
// Status message type
// ---------------------------------------------------------------------------
export type Generate3DStatus =
	| { type: 'idle' }
	| { type: 'status'; message: string; source?: 'lidar' | 'ai' }
	| { type: 'progress'; value: number }
	| { type: 'done'; blobUrl: string; idbUrl: string }
	| { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Check what's available on this device
// ---------------------------------------------------------------------------
export async function getDepthSource(): Promise<'lidar' | 'ai'> {
	const arOk = await isArDepthAvailable();
	return arOk ? 'lidar' : 'ai';
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
/**
 * Generate a 3D depth-mesh GLB for an item.
 *
 * @param itemId       Inventory item ID (used as IndexedDB key)
 * @param photoDataUrl Photo data URL (used for depth estimation + texture)
 * @param onStatus     Callback for live progress messages
 * @returns idb: URL to store on InventoryItem.modelUrl, or null on failure
 */
export async function generate3DModel(
	itemId: string,
	photoDataUrl: string,
	onStatus: (s: Generate3DStatus) => void
): Promise<string | null> {
	let depthData: Float32Array | null = null;
	let depthW = 0;
	let depthH = 0;

	// --- Step 1: Try LiDAR -------------------------------------------------
	const arAvailable = await isArDepthAvailable();

	if (arAvailable) {
		onStatus({ type: 'status', message: 'Capturing LiDAR depth…', source: 'lidar' });
		try {
			const frame = await captureArDepth();
			if (frame) {
				depthData = frame.data;
				depthW    = frame.width;
				depthH    = frame.height;
				onStatus({ type: 'status', message: 'LiDAR depth captured.', source: 'lidar' });
			}
		} catch (e) {
			console.warn('[generate3d] LiDAR capture failed, falling back to AI:', e);
		}
	}

	// --- Step 2: Fall back to Transformers.js if LiDAR unavailable ---------
	if (!depthData) {
		const result = await runDepthWorker(photoDataUrl, onStatus);
		if (!result) return null;
		depthData = result.depth;
		depthW    = result.width;
		depthH    = result.height;
	}

	// --- Step 3: Build GLB mesh --------------------------------------------
	onStatus({ type: 'status', message: 'Building 3D mesh…' });
	let glb: ArrayBuffer;
	try {
		glb = await depthToGlb(depthData, depthW, depthH, photoDataUrl);
	} catch (e) {
		onStatus({ type: 'error', message: `Mesh build failed: ${e}` });
		return null;
	}

	// --- Step 4: Save to IndexedDB -----------------------------------------
	try {
		await saveGlb(itemId, glb);
	} catch (e) {
		onStatus({ type: 'error', message: `Storage failed: ${e}` });
		return null;
	}

	const idbUrl  = `${IDB_PREFIX}${itemId}`;
	const blobUrl = await getBlobUrl(itemId);
	if (!blobUrl) {
		onStatus({ type: 'error', message: 'Could not read back stored model.' });
		return null;
	}

	onStatus({ type: 'done', blobUrl, idbUrl });
	return idbUrl;
}

/**
 * Resolve an idb: URL to a blob: URL for use in Three.js / Threlte.
 * Returns null if no model is stored for this item.
 */
export async function resolveModelUrl(idbUrl: string): Promise<string | null> {
	if (!idbUrl.startsWith(IDB_PREFIX)) return idbUrl; // already a real URL
	const itemId = idbUrl.slice(IDB_PREFIX.length);
	return getBlobUrl(itemId);
}

// ---------------------------------------------------------------------------
// Internal: run depth.worker.ts and collect the result
// ---------------------------------------------------------------------------
function runDepthWorker(
	imageDataUrl: string,
	onStatus: (s: Generate3DStatus) => void
): Promise<{ depth: Float32Array; width: number; height: number } | null> {
	return new Promise((resolve) => {
		const worker  = getDepthWorker();
		const handler = (e: MessageEvent) => {
			const msg = e.data;
			switch (msg.type) {
				case 'status':
					onStatus({ type: 'status', message: msg.message, source: 'ai' });
					break;
				case 'progress':
					onStatus({ type: 'progress', value: msg.value });
					break;
				case 'result':
					worker.removeEventListener('message', handler);
					resolve({ depth: msg.depth, width: msg.width, height: msg.height });
					break;
				case 'error':
					worker.removeEventListener('message', handler);
					onStatus({ type: 'error', message: msg.message });
					resolve(null);
					break;
			}
		};
		worker.addEventListener('message', handler);
		worker.postMessage({ imageDataUrl });
	});
}
