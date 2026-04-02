/**
 * Bundled open-source (CC0) 3D models for common household item shapes.
 * Sources: Quaternius, Kenney — poly.pizza, CC0 Public Domain.
 *
 * Each model is loaded on first use and normalised to a unit cube
 * (x/y/z each in [-0.5, 0.5]) so the caller can scale non-uniformly
 * to match any item's actual dimensions, identical to the procedural shapes.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ItemShape } from '$lib/types';

/** Shape → static path (relative to `/static`). */
export const BUNDLED_MODEL_PATHS: Partial<Record<ItemShape, string>> = {
	couch:           '/models/couch.glb',       // Quaternius — Couch Large, CC0
	chair:           '/models/chair.glb',       // Quaternius — Office Chair, CC0
	table:           '/models/desk.glb',        // Quaternius — Desk, CC0
	dresser:         '/models/dresser.glb',     // Quaternius — Closet, CC0
	mattress:        '/models/mattress.glb',    // Kenney — Bed Double, CC0
	lamp:            '/models/lamp.glb',        // CC0 — Standing Lamp
	tv:              '/models/tv.glb',          // Poly by Google — TV, CC BY
	'appliance-tall': '/models/appliance-tall.glb', // CC0 — Fridge
};

// Singleton loader
const loader = new GLTFLoader();

// Cache: path → normalised THREE.Group Promise
const groupCache = new Map<string, Promise<THREE.Group>>();

/**
 * Load and return a normalised THREE.Group for the given path.
 * The group occupies the unit cube [-0.5, 0.5] on all axes.
 * Clone the result before modifying (scale, materials, etc.).
 */
export function getBundledModelGroup(path: string): Promise<THREE.Group> {
	let p = groupCache.get(path);
	if (!p) {
		p = _loadAndNormalise(path);
		groupCache.set(path, p);
	}
	return p;
}

async function _loadAndNormalise(url: string): Promise<THREE.Group> {
	return new Promise((resolve, reject) => {
		loader.load(
			url,
			(gltf) => {
				const root = gltf.scene as THREE.Group;

				// Step 1: Compute initial bounding box
				const box1 = new THREE.Box3().setFromObject(root);
				const size1 = new THREE.Vector3();
				const center1 = new THREE.Vector3();
				box1.getSize(size1);
				box1.getCenter(center1);

				// Step 2: Scale to unit cube (each axis fits in [-0.5, 0.5])
				const sx = size1.x > 0 ? 1 / size1.x : 1;
				const sy = size1.y > 0 ? 1 / size1.y : 1;
				const sz = size1.z > 0 ? 1 / size1.z : 1;
				root.scale.set(sx, sy, sz);

				// Step 3: Recompute after scaling and center exactly
				const box2 = new THREE.Box3().setFromObject(root);
				const center2 = new THREE.Vector3();
				box2.getCenter(center2);
				root.position.x -= center2.x;
				root.position.y -= center2.y;
				root.position.z -= center2.z;

				resolve(root);
			},
			undefined,
			(err) => reject(err)
		);
	});
}

/**
 * Deep-clone a loaded model group so each instance has its own
 * transform and material instances (safe to scale / tint independently).
 */
export function cloneBundledModel(base: THREE.Group): THREE.Group {
	const clone = base.clone(true) as THREE.Group;
	clone.traverse((obj) => {
		if (obj instanceof THREE.Mesh) {
			const m = obj.material;
			if (Array.isArray(m)) {
				obj.material = m.map((mat) => mat.clone());
			} else if (m) {
				obj.material = m.clone();
			}
		}
	});
	return clone;
}
