<script lang="ts">
	import { T, Canvas } from '@threlte/core';
	import { OrbitControls, Text } from '@threlte/extras';
	import type { PackedItem, TrailerPreset } from '$lib/types';
	import * as THREE from 'three';
	import { createItemMesh, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';

	interface Props {
		trailer: TrailerPreset;
		packedItems: PackedItem[];
		loadStep: number;
		selectedItemId: string | null;
		onSelectItem: (id: string | null) => void;
	}

	let { trailer, packedItems, loadStep, selectedItemId, onSelectItem }: Props = $props();

	const SCALE = 0.02;

	const tl = $derived(trailer.length * 12 * SCALE);
	const tw = $derived(trailer.width * 12 * SCALE);
	const th = $derived(trailer.height * 12 * SCALE);

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

	function handleItemClick(id: string) {
		onSelectItem(selectedItemId === id ? null : id);
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
</script>

<Canvas>
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

	<!-- Packed items with procedural shapes -->
	{#each visibleItems as packed (packed.item.id)}
		{@const pos = itemPosition(packed)}
		{@const scl = itemScale(packed)}
		{@const isSelected = selectedItemId === packed.item.id}
		{@const shapeMesh = getShapeMesh(packed)}

		<T.Group position={pos}>
			<!-- Invisible click target (bounding box) -->
			<T.Mesh onclick={() => handleItemClick(packed.item.id)}>
				<T.BoxGeometry args={scl} />
				<T.MeshBasicMaterial visible={false} />
			</T.Mesh>

			<!-- Procedural shape -->
			<T is={shapeMesh.clone()} />

			<!-- Selection wireframe -->
			{#if isSelected}
				<T.LineSegments>
					<T.EdgesGeometry args={[new THREE.BoxGeometry(...scl)]} />
					<T.LineBasicMaterial color="#ffffff" transparent opacity={0.9} />
				</T.LineSegments>
			{/if}

			{#if isSelected}
				<Text
					text={packed.item.name}
					fontSize={0.06}
					color="white"
					anchorY="bottom"
					position.y={scl[1] / 2 + 0.04}
					outlineWidth={0.005}
					outlineColor="#000000"
				/>
			{/if}
		</T.Group>
	{/each}
</Canvas>
