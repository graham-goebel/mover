<script lang="ts">
	import { T, Canvas } from '@threlte/core';
	import { OrbitControls, Text, GLTF } from '@threlte/extras';
	import type { PackedItem, TrailerPreset } from '$lib/types';
	import * as THREE from 'three';
	import { createItemMesh, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';
	import { resolveModelUrl } from '$lib/utils/generate3d';
	import SceneSetup from './SceneSetup.svelte';
	import DragController from './DragController.svelte';

	interface Props {
		trailer: TrailerPreset;
		packedItems: PackedItem[];
		loadStep: number;
		selectedItemId: string | null;
		onSelectItem: (id: string | null) => void;
		onMoveItem?: (id: string, position: { x: number; y: number; z: number }) => void;
	}

	let { trailer, packedItems, loadStep, selectedItemId, onSelectItem, onMoveItem }: Props = $props();

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
</script>

<Canvas>
	<SceneSetup />
	<DragController
		{packedItems}
		{trailer}
		scale={SCALE}
		trailerSceneLength={tl}
		trailerSceneWidth={tw}
		{selectedItemId}
		{onSelectItem}
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

	<T.GridHelper args={[Math.max(tl, tw) * 3, 20, '#262626', '#1a1a1a']} />

	<!-- Trailer wireframe -->
	<T.Mesh position={[0, th / 2, 0]}>
		<T.BoxGeometry args={[tl, th, tw]} />
		<T.MeshBasicMaterial color="#525252" wireframe transparent opacity={0.3} />
	</T.Mesh>

	<!-- Trailer floor -->
	<T.Mesh position={[0, 0.001, 0]} rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[tl, tw]} />
		<T.MeshStandardMaterial color="#111111" transparent opacity={0.8} />
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
		{@const isSelected = selectedItemId === packed.item.id}
		{@const isBeingDragged = dragId === packed.item.id}

		<T.Group position={pos}>
			{#if packed.item.modelUrl}
				{#key packed.item.modelUrl}
					{#await resolveUrl(packed.item.modelUrl) then blobUrl}
						{#if blobUrl}
							<GLTF url={blobUrl} scale={[scl[0], scl[1], scl[2]]} />
						{:else}
							{@const shapeMesh = getShapeMesh(packed)}
							<T is={shapeMesh.clone()} />
						{/if}
					{/await}
				{/key}
			{:else}
				{@const shapeMesh = getShapeMesh(packed)}
				<T is={shapeMesh.clone()} />
			{/if}

			<!-- Bounding box wireframe -->
			<T.LineSegments>
				<T.EdgesGeometry args={[new THREE.BoxGeometry(...scl)]} />
				<T.LineBasicMaterial
					color={isSelected ? (isBeingDragged ? '#facc15' : '#ffffff') : '#000000'}
					transparent
					opacity={isSelected ? 1 : 0.15}
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
