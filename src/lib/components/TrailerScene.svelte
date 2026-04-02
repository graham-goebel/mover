<script lang="ts">
	import { T, Canvas } from '@threlte/core';
	import { OrbitControls, Text, GLTF } from '@threlte/extras';
	import type { PackedItem, TrailerPreset } from '$lib/types';
	import * as THREE from 'three';
	import { browser } from '$app/environment';
	import { createItemMesh, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';
	import { resolveModelUrl } from '$lib/utils/generate3d';
	import { addPhotoTextureToShapeClone, isUsableItemPhoto, applyTextureToGroupMaterials, getSharedPhotoTexture } from '$lib/utils/itemTexture';
	import { BUNDLED_MODEL_PATHS, getBundledModelGroup, cloneBundledModel } from '$lib/utils/shapeModels';
	import SceneSetup from './SceneSetup.svelte';
	import DragController from './DragController.svelte';

	// Track light/dark theme so grid and floor colors can adapt
	let isLight = $state(false);
	$effect(() => {
		if (!browser) return;
		const update = () => { isLight = document.documentElement.dataset.theme === 'light'; };
		update();
		const obs = new MutationObserver(update);
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => obs.disconnect();
	});

	interface Props {
		trailer: TrailerPreset;
		packedItems: PackedItem[];
		loadStep: number;
		selectedItemIds: Set<string>;
		snapTargetId?: string | null;
		onSelectItem: (id: string, shift: boolean) => void;
		onClickEmpty?: () => void;
		onDragStart?: (id: string) => void;
		onMoveItem?: (id: string, position: { x: number; y: number; z: number }) => void;
		/** Map item photos onto procedural shapes (couch, chair, etc.); ignored for GLB scans. */
		wrapPhotoOnShapes?: boolean;
	}

	let {
		trailer,
		packedItems,
		loadStep,
		selectedItemIds,
		snapTargetId = null,
		onSelectItem,
		onClickEmpty,
		onDragStart,
		onMoveItem,
		wrapPhotoOnShapes = false
	}: Props = $props();

	const SCALE = 0.02;

	const tl = $derived(trailer.length * 12 * SCALE);
	const tw = $derived(trailer.width * 12 * SCALE);
	const th = $derived(trailer.height * 12 * SCALE);

	const endLabelFontSize = $derived(Math.max(0.048, Math.min(0.11, tl * 0.034)));

	const visibleItems = $derived(
		loadStep > 0
			? packedItems.slice(0, loadStep)
			: packedItems
	);

	function itemPosition(item: PackedItem): [number, number, number] {
		const x = item.position.x * SCALE + (item.rotation.l * SCALE) / 2 - tl / 2;
		const y = item.position.y * SCALE + (item.rotation.h * SCALE) / 2;
		const z = item.position.z * SCALE + (item.rotation.w * SCALE) / 2 - tw / 2;
		return [x, y, z];
	}

	function itemScale(item: PackedItem): [number, number, number] {
		return [
			item.rotation.l * SCALE,
			item.rotation.h * SCALE,
			item.rotation.w * SCALE
		];
	}

	let dragId = $state<string | null>(null);

	function handleDragStart(id: string) {
		dragId = id;
		onDragStart?.(id);
	}

	function handleDragMove(id: string, pos: { x: number; y: number; z: number }) {
		onMoveItem?.(id, pos);
	}

	function handleDragEnd() {
		dragId = null;
	}

	const meshCache = new Map<string, THREE.Group>();

	function getShapeMesh(packed: PackedItem): THREE.Group {
		const scl = itemScale(packed);
		const cacheKey = `${packed.item.id}-${packed.color}-${scl.join(',')}`;
		let group = meshCache.get(cacheKey);
		if (!group) {
			const shape = packed.item.shape
				?? CATEGORY_DEFAULT_SHAPE[packed.item.category]
				?? 'generic';
			group = createItemMesh(shape, packed.color, scl[0], scl[1], scl[2]);
			meshCache.set(cacheKey, group);
		}
		return group;
	}

	const blobUrlCache = new Map<string, string | null>();

	async function resolveUrl(idbUrl: string): Promise<string | null> {
		if (blobUrlCache.has(idbUrl)) return blobUrlCache.get(idbUrl)!;
		const url = await resolveModelUrl(idbUrl);
		blobUrlCache.set(idbUrl, url);
		return url;
	}

	const texturedMeshCache = new Map<string, Promise<THREE.Group>>();

	function texturedMeshCacheKey(packed: PackedItem): string {
		const scl = itemScale(packed);
		return `${packed.item.id}\0${packed.item.photo}\0${packed.color}\0${scl.join(',')}`;
	}

	function getTexturedShapeDisplayMesh(packed: PackedItem): Promise<THREE.Group> {
		const key = texturedMeshCacheKey(packed);
		let pending = texturedMeshCache.get(key);
		if (!pending) {
			pending = (async () => {
				const base = getShapeMesh(packed);
				return addPhotoTextureToShapeClone(base, packed.item.photo);
			})();
			texturedMeshCache.set(key, pending);
		}
		return pending;
	}

	function plainShapeClone(packed: PackedItem): THREE.Group {
		return getShapeMesh(packed).clone() as THREE.Group;
	}

	// ---- Bundled model cache ----------------------------------------
	// Key: itemId + shape + photo (if photo texture requested) + scale
	const bundledMeshCache = new Map<string, Promise<THREE.Group>>();

	function bundledMeshCacheKey(packed: PackedItem): string {
		const scl = itemScale(packed);
		const photoKey = (wrapPhotoOnShapes && isUsableItemPhoto(packed.item.photo))
			? packed.item.photo
			: 'nophoto';
		return `${packed.item.shape}\0${photoKey}\0${scl.join(',')}`;
	}

	function getBundledDisplayMesh(packed: PackedItem): Promise<THREE.Group> {
		const key = bundledMeshCacheKey(packed);
		let p = bundledMeshCache.get(key);
		if (!p) {
			const scl = itemScale(packed);
			const modelPath = BUNDLED_MODEL_PATHS[packed.item.shape]!;
			p = (async () => {
				const base = await getBundledModelGroup(modelPath);
				// Clone preserves the normalisation scale/position baked in by _loadAndNormalise.
				// Wrap in a parent group and scale that instead — replacing clone.scale would
				// break the centering offset computed during normalisation.
				const clone = cloneBundledModel(base);
				const wrapper = new THREE.Group();
				wrapper.add(clone);
				wrapper.scale.set(scl[0], scl[1], scl[2]);

				// Optionally apply item photo as texture
				if (wrapPhotoOnShapes && isUsableItemPhoto(packed.item.photo)) {
					try {
						const tex = await getSharedPhotoTexture(packed.item.photo);
						applyTextureToGroupMaterials(clone, tex);
					} catch {
						// Texture failed — render without photo
					}
				}
				return wrapper;
			})();
			bundledMeshCache.set(key, p);
		}
		return p;
	}

	function hasBundledModel(packed: PackedItem): boolean {
		return packed.item.shape in BUNDLED_MODEL_PATHS;
	}
</script>

<Canvas rendererParameters={{ alpha: true }}>
	<SceneSetup />
	<DragController
		{packedItems}
		{trailer}
		scale={SCALE}
		trailerSceneLength={tl}
		trailerSceneWidth={tw}
		{selectedItemIds}
		onSelectItem={onSelectItem}
		onClickEmpty={() => onClickEmpty?.()}
		onDragStart={handleDragStart}
		onDragMove={handleDragMove}
		onDragEnd={handleDragEnd}
	/>
	<T.PerspectiveCamera
		makeDefault
		position={[tl * 1.5, th * 1.5, tw * 2]}
		fov={50}
	>
		<OrbitControls
			enableDamping
			dampingFactor={0.15}
			target={[0, th / 2, 0]}
			maxPolarAngle={Math.PI / 2 + 0.1}
			enabled={!dragId}
		/>
	</T.PerspectiveCamera>

	<T.AmbientLight intensity={0.6} />
	<T.DirectionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
	<T.DirectionalLight position={[-3, 4, -3]} intensity={0.3} />

	<T.GridHelper args={[Math.max(tl, tw) * 3, 20, isLight ? '#c4c4c4' : '#262626', isLight ? '#d4d4d4' : '#1a1a1a']} />

	<!-- Trailer wireframe -->
	<T.Mesh position={[0, th / 2, 0]}>
		<T.BoxGeometry args={[tl, th, tw]} />
		<T.MeshBasicMaterial color="#525252" wireframe transparent opacity={0.3} />
	</T.Mesh>

	<!-- Trailer floor -->
	<T.Mesh position={[0, 0.001, 0]} rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[tl, tw]} />
		<T.MeshStandardMaterial color={isLight ? '#d0d0d0' : '#111111'} transparent opacity={0.8} />
	</T.Mesh>

	<Text
		text={'FRONT\nHitch · tow vehicle\n(heavier load here)'}
		fontSize={endLabelFontSize}
		lineHeight={1.15}
		color="#fafafa"
		anchorX="center"
		anchorY="middle"
		position={[-tl / 2 + 0.06, th * 0.32, 0]}
		rotation={[0, Math.PI / 2, 0]}
		outlineWidth={0.004}
		outlineColor="#0a0a0a"
	/>
	<Text
		text={'BACK\nRamp / door'}
		fontSize={endLabelFontSize * 0.95}
		lineHeight={1.15}
		color="#a3a3a3"
		anchorX="center"
		anchorY="middle"
		position={[tl / 2 - 0.06, th * 0.32, 0]}
		rotation={[0, -Math.PI / 2, 0]}
		outlineWidth={0.004}
		outlineColor="#0a0a0a"
	/>

	<!-- Packed items -->
	{#each visibleItems as packed (packed.item.id)}
		{@const pos = itemPosition(packed)}
		{@const scl = itemScale(packed)}
		{@const isSelected = selectedItemIds.has(packed.item.id)}
		{@const isSnapTarget = snapTargetId === packed.item.id}
		{@const isBeingDragged = dragId === packed.item.id}

		<T.Group position={pos}>
			{#if packed.item.modelUrl}
				<!-- Priority 1: user-generated GLB from photo scan -->
				{#key packed.item.modelUrl}
					{#await resolveUrl(packed.item.modelUrl) then blobUrl}
						{#if blobUrl}
							<GLTF url={blobUrl} scale={[scl[0], scl[1], scl[2]]} />
						{:else}
							<!-- GLB resolved to nothing — fall through to bundled/procedural -->
							{#if hasBundledModel(packed)}
								{#await getBundledDisplayMesh(packed) then mesh}
									<T is={mesh} />
								{:catch}
									<T is={plainShapeClone(packed)} />
								{/await}
							{:else if wrapPhotoOnShapes && isUsableItemPhoto(packed.item.photo)}
								{#await getTexturedShapeDisplayMesh(packed) then mesh}
									<T is={mesh} />
								{:catch}
									<T is={plainShapeClone(packed)} />
								{/await}
							{:else}
								<T is={plainShapeClone(packed)} />
							{/if}
						{/if}
					{/await}
				{/key}
			{:else if hasBundledModel(packed)}
				<!-- Priority 2: bundled open-source model (with optional photo texture) -->
				{#await getBundledDisplayMesh(packed) then mesh}
					<T is={mesh} />
				{:catch}
					<T is={plainShapeClone(packed)} />
				{/await}
			{:else if wrapPhotoOnShapes && isUsableItemPhoto(packed.item.photo)}
				<!-- Priority 3: photo texture on procedural shape -->
				{#await getTexturedShapeDisplayMesh(packed) then mesh}
					<T is={mesh} />
				{:catch}
					<T is={plainShapeClone(packed)} />
				{/await}
			{:else}
				<!-- Priority 4: plain procedural shape -->
				<T is={plainShapeClone(packed)} />
			{/if}

			<!-- Bounding box wireframe -->
			<T.LineSegments>
				<T.EdgesGeometry args={[new THREE.BoxGeometry(...scl)]} />
				<T.LineBasicMaterial
					color={isSelected ? (isBeingDragged ? '#facc15' : '#ffffff') : isSnapTarget ? '#f97316' : '#000000'}
					transparent
					opacity={isSelected ? 1 : isSnapTarget ? 0.9 : 0.15}
				/>
			</T.LineSegments>

			{#if isSelected}
				<Text
					text={packed.item.name}
					fontSize={Math.max(0.04, Math.min(0.08, scl[0] * 0.4))}
					color="white"
					anchorY="bottom"
					anchorX="center"
					position.y={scl[1] / 2 + 0.05}
					outlineWidth={0.006}
					outlineColor="#000000"
				/>
				<Text
					text="{packed.rotation.l}″×{packed.rotation.w}″×{packed.rotation.h}″"
					fontSize={Math.max(0.03, Math.min(0.05, scl[0] * 0.25))}
					color="#a3a3a3"
					anchorY="top"
					anchorX="center"
					position.y={-(scl[1] / 2 + 0.03)}
					outlineWidth={0.004}
					outlineColor="#000000"
				/>
			{/if}
		</T.Group>
	{/each}
</Canvas>
