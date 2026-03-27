<script lang="ts">
	import { T, Canvas } from '@threlte/core';
	import { OrbitControls, Text } from '@threlte/extras';
	import type { PackedItem, TrailerPreset } from '$lib/types';
	import * as THREE from 'three';

	interface Props {
		trailer: TrailerPreset;
		packedItems: PackedItem[];
		loadStep: number;
		selectedId: string | null;
		onSelectItem: (id: string | null) => void;
	}

	let { trailer, packedItems, loadStep, selectedId, onSelectItem }: Props = $props();

	const SCALE = 0.02; // inches to scene units

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
		onSelectItem(selectedId === id ? null : id);
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

	<!-- Floor grid -->
	<T.GridHelper args={[Math.max(tl, tw) * 3, 20, '#262626', '#1a1a1a']} />

	<!-- Trailer wireframe shell -->
	<T.Mesh position={[0, th / 2, 0]}>
		<T.BoxGeometry args={[tl, th, tw]} />
		<T.MeshBasicMaterial
			color="#525252"
			wireframe
			transparent
			opacity={0.3}
		/>
	</T.Mesh>

	<!-- Trailer floor (semi-transparent) -->
	<T.Mesh position={[0, 0.001, 0]} rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[tl, tw]} />
		<T.MeshStandardMaterial
			color="#111111"
			transparent
			opacity={0.8}
		/>
	</T.Mesh>

	<!-- Packed items -->
	{#each visibleItems as packed (packed.item.id)}
		{@const pos = itemPosition(packed)}
		{@const scl = itemScale(packed)}
		{@const isSelected = selectedId === packed.item.id}

		<T.Group position={pos}>
			<T.Mesh
				onclick={() => handleItemClick(packed.item.id)}
			>
				<T.BoxGeometry args={scl} />
				<T.MeshStandardMaterial
					color={packed.color}
					transparent
					opacity={isSelected ? 1 : 0.85}
					roughness={0.4}
					metalness={0.1}
				/>
			</T.Mesh>

			<!-- Item edges for visibility -->
			<T.LineSegments>
				<T.EdgesGeometry args={[new THREE.BoxGeometry(...scl)]} />
				<T.LineBasicMaterial
					color={isSelected ? '#ffffff' : '#000000'}
					transparent
					opacity={isSelected ? 0.9 : 0.2}
				/>
			</T.LineSegments>

			<!-- Label above item -->
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
