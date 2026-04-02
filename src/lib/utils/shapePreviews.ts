/**
 * Renders each ItemShape to a small PNG data-URL for use in the shape picker UI.
 * Uses a single shared WebGLRenderer; results are cached for the lifetime of the page.
 */
import * as THREE from 'three';
import type { ItemShape } from '$lib/types';
import { SHAPE_OPTIONS, createItemMesh } from '$lib/utils/shapes';
import { BUNDLED_MODEL_PATHS, getBundledModelGroup, cloneBundledModel } from '$lib/utils/shapeModels';

let _cache: Map<string, string> | null = null;
let _promise: Promise<Map<string, string>> | null = null;

/** Returns a Map<shape, dataURL> once all previews have been rendered. */
export function getShapePreviews(): Promise<Map<string, string>> {
	if (_cache) return Promise.resolve(_cache);
	if (!_promise) _promise = _renderAll();
	return _promise;
}

async function _renderAll(): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const SIZE = 80;

	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setSize(SIZE, SIZE, false);
	renderer.setPixelRatio(Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, 2));
	renderer.setClearColor(0x000000, 0);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);

	// Three-point lighting for clear shape readability
	scene.add(new THREE.AmbientLight(0xffffff, 0.65));
	const sun = new THREE.DirectionalLight(0xffffff, 0.95);
	sun.position.set(2, 4, 2);
	scene.add(sun);
	const fill = new THREE.DirectionalLight(0x9bb8e8, 0.35);
	fill.position.set(-2, 1, -1);
	scene.add(fill);

	for (const opt of SHAPE_OPTIONS) {
		const shape = opt.value as ItemShape;
		let mesh: THREE.Group | undefined;
		try {
			const modelPath = BUNDLED_MODEL_PATHS[shape];
			if (modelPath) {
				const base = await getBundledModelGroup(modelPath);
				mesh = cloneBundledModel(base);
			} else {
				// Procedural mesh at unit scale; uses a warm grey
				mesh = createItemMesh(shape, '#8ba3c4', 1, 1, 1);
			}

			// Fit camera dynamically to this shape's bounding box
			const box = new THREE.Box3().setFromObject(mesh);
			const center = new THREE.Vector3();
			const size = new THREE.Vector3();
			box.getCenter(center);
			box.getSize(size);
			const maxDim = Math.max(size.x, size.y, size.z, 0.1);
			// Distance so the model fills ~60% of the viewport
			const dist = (maxDim / (2 * Math.tan(Math.PI * 22.5 / 180))) * 1.55;
			camera.position.set(
				center.x + dist * 0.65,
				center.y + dist * 0.5,
				center.z + dist
			);
			camera.lookAt(center);

			scene.add(mesh);
			renderer.render(scene, camera);
			scene.remove(mesh);
			map.set(shape, canvas.toDataURL('image/png'));

			// Dispose cloned materials to avoid leaking GPU memory
			mesh.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					const m = obj.material;
					if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
					else if (m) m.dispose();
				}
			});
		} catch (err) {
			console.warn(`[ShapePreviews] Failed for shape "${shape}":`, err);
		}
	}

	renderer.dispose();
	_cache = map;
	return map;
}
