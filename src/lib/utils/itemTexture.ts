/**
 * Apply inventory photos as diffuse maps on procedural shape meshes (couch, chair, etc.).
 */

import * as THREE from 'three';

const textureByUrl = new Map<string, Promise<THREE.Texture>>();

export function isUsableItemPhoto(photo: string | undefined | null): boolean {
	if (!photo || !photo.trim()) return false;
	if (photo.startsWith('data:image/svg+xml')) return false;
	return (
		photo.startsWith('data:') ||
		photo.startsWith('http://') ||
		photo.startsWith('https://') ||
		photo.startsWith('blob:')
	);
}

function loadPhotoTexture(photoUrl: string): Promise<THREE.Texture> {
	return new Promise((resolve, reject) => {
		const loader = new THREE.TextureLoader();
		if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
			loader.setCrossOrigin('anonymous');
		}
		loader.load(
			photoUrl,
			(tex) => {
				tex.colorSpace = THREE.SRGBColorSpace;
				tex.wrapS = THREE.ClampToEdgeWrapping;
				tex.wrapT = THREE.ClampToEdgeWrapping;
				resolve(tex);
			},
			undefined,
			reject
		);
	});
}

/** One THREE.Texture instance per URL (shared across items / sub-meshes). */
export function getSharedPhotoTexture(photoUrl: string): Promise<THREE.Texture> {
	let p = textureByUrl.get(photoUrl);
	if (!p) {
		p = loadPhotoTexture(photoUrl);
		textureByUrl.set(photoUrl, p);
	}
	return p;
}

/**
 * Deep-clone a group so each mesh has its own material instances (safe to set .map).
 */
export function cloneGroupWithUniqueMaterials(source: THREE.Object3D): THREE.Group {
	const clone = source.clone(true) as THREE.Group;
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

export function applyTextureToGroupMaterials(group: THREE.Object3D, texture: THREE.Texture): void {
	group.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh)) return;
		const processMat = (mat: THREE.Material) => {
			if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
				mat.map = texture;
				mat.color.setRGB(1, 1, 1);
				mat.needsUpdate = true;
			}
		};
		if (Array.isArray(obj.material)) {
			for (const m of obj.material) processMat(m);
		} else if (obj.material) {
			processMat(obj.material);
		}
	});
}

/** Clone procedural mesh and map the item photo onto all standard materials. */
export async function addPhotoTextureToShapeClone(
	source: THREE.Group,
	photoUrl: string
): Promise<THREE.Group> {
	const clone = cloneGroupWithUniqueMaterials(source);
	const tex = await getSharedPhotoTexture(photoUrl);
	applyTextureToGroupMaterials(clone, tex);
	return clone;
}
