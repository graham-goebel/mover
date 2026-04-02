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
		selectedItemIds: Set<string>;
		onSelectItem: (id: string, shift: boolean) => void;
		onClickEmpty: () => void;
		onDragStart: (id: string) => void;
		onDragMove: (id: string, position: { x: number; y: number; z: number }) => void;
		onDragEnd: () => void;
	}

	let {
		packedItems,
		trailer,
		scale,
		trailerSceneLength: tl,
		trailerSceneWidth: tw,
		selectedItemIds,
		onSelectItem,
		onClickEmpty,
		onDragStart,
		onDragMove,
		onDragEnd
	}: Props = $props();

	const { camera, renderer } = useThrelte();

	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();
	const hitPoint = new THREE.Vector3();
	const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

	let activeId: string | null = null;
	let dragging = false;
	let offset = { x: 0, z: 0 };
	let initialized = false;
	let downPos = { x: 0, y: 0 };
	let shiftOnDown = false;
	let downOnEmpty = false;

	function mouseToNDC(e: PointerEvent) {
		const rect = renderer.domElement.getBoundingClientRect();
		mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
	}

	function hitTestItems(e: PointerEvent): string | null {
		const cam = camera.current;
		if (!cam) return null;
		mouseToNDC(e);
		raycaster.setFromCamera(mouse, cam);

		let closest: { id: string; dist: number } | null = null;

		for (const packed of packedItems) {
			const pos = new THREE.Vector3(
				packed.position.x * scale + (packed.rotation.l * scale) / 2 - tl / 2,
				packed.position.y * scale + (packed.rotation.h * scale) / 2,
				packed.position.z * scale + (packed.rotation.w * scale) / 2 - tw / 2
			);
			const halfSize = new THREE.Vector3(
				(packed.rotation.l * scale) / 2,
				(packed.rotation.h * scale) / 2,
				(packed.rotation.w * scale) / 2
			);
			const box = new THREE.Box3(
				pos.clone().sub(halfSize),
				pos.clone().add(halfSize)
			);
			const intersection = raycaster.ray.intersectBox(box, new THREE.Vector3());
			if (intersection) {
				const dist = intersection.distanceTo(raycaster.ray.origin);
				if (!closest || dist < closest.dist) {
					closest = { id: packed.item.id, dist };
				}
			}
		}
		return closest?.id ?? null;
	}

	function screenToPlane(e: PointerEvent): THREE.Vector3 | null {
		const cam = camera.current;
		if (!cam) return null;
		mouseToNDC(e);
		raycaster.setFromCamera(mouse, cam);
		if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) return hitPoint.clone();
		return null;
	}

	function handleDown(e: PointerEvent) {
		if (e.button !== 0) return;
		downPos = { x: e.clientX, y: e.clientY };

		const id = hitTestItems(e);
		if (!id) {
			downOnEmpty = true;
			activeId = null;
			dragging = false;
			return;
		}

		downOnEmpty = false;
		shiftOnDown = e.shiftKey;
		activeId = id;
		dragging = false;
		initialized = false;

		const packed = packedItems.find(p => p.item.id === id);
		if (packed) {
			const itemY = packed.position.y * scale + (packed.rotation.h * scale) / 2;
			dragPlane.constant = -itemY;
		}
	}

	function handleMove(e: PointerEvent) {
		if (!activeId) return;

		const dx = e.clientX - downPos.x;
		const dy = e.clientY - downPos.y;
		if (!dragging && Math.hypot(dx, dy) < 4) return;

		if (!dragging) {
			dragging = true;
			onDragStart(activeId);
		}

		const current = packedItems.find(p => p.item.id === activeId);
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

		onDragMove(activeId, {
			x: Math.max(0, Math.min(maxX, rawX)),
			y: current.position.y,
			z: Math.max(0, Math.min(maxZ, rawZ))
		});
	}

	function handleUp(fromLeave = false) {
		if (activeId && !dragging) {
			onSelectItem(activeId, shiftOnDown);
		} else if (!activeId && !dragging && downOnEmpty && !fromLeave) {
			onClickEmpty();
		}
		if (dragging) {
			onDragEnd();
		}
		activeId = null;
		dragging = false;
		initialized = false;
		downOnEmpty = false;
		shiftOnDown = false;
	}

	$effect(() => {
		const canvas = renderer.domElement;
		if (!canvas) return;

		const onUp = () => handleUp(false);
		const onLeave = () => handleUp(true);

		canvas.addEventListener('pointerdown', handleDown);
		canvas.addEventListener('pointermove', handleMove);
		canvas.addEventListener('pointerup', onUp);
		canvas.addEventListener('pointerleave', onLeave);

		return () => {
			canvas.removeEventListener('pointerdown', handleDown);
			canvas.removeEventListener('pointermove', handleMove);
			canvas.removeEventListener('pointerup', onUp);
			canvas.removeEventListener('pointerleave', onLeave);
		};
	});
</script>
