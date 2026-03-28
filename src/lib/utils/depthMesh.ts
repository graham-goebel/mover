/**
 * depthMesh.ts
 * Convert a depth map (Float32Array, 0–1 normalized) + photo into a GLB.
 *
 * Strategy: displace a PlaneGeometry's vertices along Z by the depth value,
 * apply the photo as a texture, export via THREE's GLTFExporter.
 *
 * Depth-Anything convention: higher value = closer to camera.
 * We invert so that close objects protrude toward the viewer (positive Z).
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/** Mesh resolution — more segments = smoother relief, heavier file */
const GRID = 96;

/**
 * Build a displaced-plane GLB from a depth map and the original photo.
 *
 * @param depthData  Normalized float32 depth values (0 = far, 1 = near)
 * @param depthW     Width of the depth map in pixels
 * @param depthH     Height of the depth map in pixels
 * @param photoDataUrl  Original photo as a data URL (used as texture)
 * @param depthScale Controls how much the surface extrudes (default 0.35)
 */
export async function depthToGlb(
	depthData: Float32Array,
	depthW: number,
	depthH: number,
	photoDataUrl: string,
	depthScale = 0.35
): Promise<ArrayBuffer> {
	// --- Build displaced plane geometry ----------------------------------
	const geo = new THREE.PlaneGeometry(1, 1, GRID, GRID);
	const pos = geo.attributes.position as THREE.BufferAttribute;

	for (let i = 0; i < pos.count; i++) {
		// PlaneGeometry: x ∈ [-0.5, 0.5], y ∈ [-0.5, 0.5]
		const u = pos.getX(i) + 0.5;          // 0–1 left→right
		const v = 0.5 - pos.getY(i);           // 0–1 top→bottom

		const px = Math.min(Math.round(u * (depthW - 1)), depthW - 1);
		const py = Math.min(Math.round(v * (depthH - 1)), depthH - 1);

		// Higher depth value = closer = more protrusion
		const depth = depthData[py * depthW + px];
		pos.setZ(i, depth * depthScale);
	}

	geo.computeVertexNormals();

	// --- Texture ---------------------------------------------------------
	const texture = await loadTexture(photoDataUrl);
	texture.flipY = false; // GLTFExporter expects flipY=false

	const mat = new THREE.MeshStandardMaterial({
		map: texture,
		side: THREE.FrontSide,
		metalness: 0,
		roughness: 0.8
	});

	const mesh = new THREE.Mesh(geo, mat);
	// Stand the plane upright so it faces +Z in the scene
	mesh.rotation.x = -Math.PI / 2;
	mesh.updateMatrix();

	return exportGlb(mesh);
}

function loadTexture(dataUrl: string): Promise<THREE.Texture> {
	return new Promise((resolve, reject) => {
		new THREE.TextureLoader().load(dataUrl, resolve, undefined, reject);
	});
}

function exportGlb(object: THREE.Object3D): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const exporter = new GLTFExporter();
		exporter.parse(
			object,
			(result) => resolve(result as ArrayBuffer),
			(err) => reject(err),
			{ binary: true }
		);
	});
}
