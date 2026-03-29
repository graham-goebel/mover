<script lang="ts">
	import { useThrelte } from '@threlte/core';
	import * as THREE from 'three';
	import type { PackedItem, TrailerPreset } from '$lib/types';

	interface Props {
		packedItems: PackedItem[];
		trailer: TrailerPreset;
		scale: number;
		trailerSceneLength: number;
		trailerSceneWidth: number;
		dragItemId: string | null;
		onDragMove: (id: string, position: { x: number; y: number; z: number }) => void;
		onDragEnd: () => void;
	}

	let {
		packedItems,
		trailer,
		scale,
		trailerSceneLength: tl,
		trailerSceneWidth: tw,
		dragItemId,
		onDragMove,
		onDragEnd
	}: Props = $props();

	const { camera, renderer } = useThrelte();

	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();
	const hitPoint = new THREE.Vector3();
	const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

	let offset = { x: 0, z: 0 };
	let initialized = false;

	function screenToPlane(e: PointerEvent): THREE.Vector3 | null {
		const canvas = renderer.domElement;
		const rect = canvas.getBoundingClientRect();
		mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

		const cam = camera.current;
		if (!cam) return null;

		raycaster.setFromCamera(mouse, cam);
		if (raycaster.ray.intersectPlane(plane, hitPoint)) return hitPoint.clone();
		return null;
	}

	$effect(() => {
		if (!dragItemId) {
			initialized = false;
			return;
		}

		// #region agent log
		fetch('http://127.0.0.1:7843/ingest/b4c5b2e9-c26b-4911-bef1-be346f3fecc8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7c19a'},body:JSON.stringify({sessionId:'d7c19a',location:'DragController.svelte:effect',message:'effect running, dragItemId set',data:{dragItemId},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
		// #endregion

		const canvas = renderer.domElement;
		const packed = packedItems.find(p => p.item.id === dragItemId);
		if (!packed) return;

		const itemY = packed.position.y * scale + (packed.rotation.h * scale) / 2;
		plane.constant = -itemY;
		initialized = false;

		function handleMove(e: PointerEvent) {
			if (!dragItemId) return;
			const current = packedItems.find(p => p.item.id === dragItemId);
			if (!current) return;

			const pos = screenToPlane(e);
			if (!pos) return;

			if (!initialized) {
				const sceneX = current.position.x * scale + (current.rotation.l * scale) / 2 - tl / 2;
				const sceneZ = current.position.z * scale + (current.rotation.w * scale) / 2 - tw / 2;
				offset = { x: sceneX - pos.x, z: sceneZ - pos.z };
				initialized = true;
				return;
			}

			const sceneX = pos.x + offset.x;
			const sceneZ = pos.z + offset.z;

			const halfL = current.rotation.l * scale / 2;
			const halfW = current.rotation.w * scale / 2;
			const rawX = (sceneX + tl / 2 - halfL) / scale;
			const rawZ = (sceneZ + tw / 2 - halfW) / scale;

			const maxX = trailer.length * 12 - current.rotation.l;
			const maxZ = trailer.width * 12 - current.rotation.w;

			onDragMove(dragItemId, {
				x: Math.max(0, Math.min(maxX, rawX)),
				y: current.position.y,
				z: Math.max(0, Math.min(maxZ, rawZ))
			});
		}

		function handleUp() {
			// #region agent log
			fetch('http://127.0.0.1:7843/ingest/b4c5b2e9-c26b-4911-bef1-be346f3fecc8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7c19a'},body:JSON.stringify({sessionId:'d7c19a',location:'DragController.svelte:handleUp',message:'pointerup on canvas',data:{dragItemId},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
			// #endregion
			onDragEnd();
		}

		canvas.addEventListener('pointermove', handleMove);
		canvas.addEventListener('pointerup', handleUp);
		canvas.addEventListener('pointerleave', handleUp);

		return () => {
			canvas.removeEventListener('pointermove', handleMove);
			canvas.removeEventListener('pointerup', handleUp);
			canvas.removeEventListener('pointerleave', handleUp);
		};
	});
</script>
