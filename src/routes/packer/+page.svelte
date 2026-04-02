<script lang="ts">
	import { browser } from '$app/environment';
	import type { PackedItem, TrailerPreset, PackResult, InventoryItem } from '$lib/types';
	import { trailer, packResult, loadOrderStep, TRAILER_PRESETS, packResultToRemote } from '$lib/stores/trailer';
	import { inventory } from '$lib/stores/inventory';
	import { packItems, packedItemCollidesWithAnyPeer, buildRoomColorMap } from '$lib/utils/packing';
	import { SHAPE_OPTIONS } from '$lib/utils/shapes';
	import { syncTrailer, syncPackState } from '$lib/stores/sync';
	import TrailerScene from '$lib/components/TrailerScene.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';

	let currentTrailer = $state<TrailerPreset>({ ...TRAILER_PRESETS[2] });
	let result = $state<PackResult | null>(null);
	let step = $state(0);
	/** Set of all selected placed-item IDs */
	let selectedItemIds = $state(new Set<string>());
	/** The last-clicked item (used for snap controls, detail card, drag anchor) */
	let primarySelectedId = $state<string | null>(null);
	/** Stack ordering: index 0 = top of stack, last index = bottom (floor) */
	let stackOrder = $state<string[]>([]);
	/** When set, show snap-to controls for placing primarySelected relative to this item */
	let snapTargetId = $state<string | null>(null);
	let items = $state<InventoryItem[]>([]);
	let packedIds = $state(new Set<string>());

	type PackerTab = 'inventory' | 'stats';
	let activeTab = $state<PackerTab>('inventory');

	let trailerDropdownOpen = $state(false);
	let showCustomTrailer = $state(false);
	let customLength = $state(12);
	let customWidth = $state(6);
	let customHeight = $state(6.5);

	const WRAP_PHOTO_SHAPES_KEY = 'mover-wrap-photo-shapes';
	let wrapPhotoOnShapes = $state(
		browser && typeof localStorage !== 'undefined' && localStorage.getItem(WRAP_PHOTO_SHAPES_KEY) === '1'
	);

	$effect(() => {
		if (browser && typeof localStorage !== 'undefined') {
			localStorage.setItem(WRAP_PHOTO_SHAPES_KEY, wrapPhotoOnShapes ? '1' : '0');
		}
	});

	function selectPreset(preset: TrailerPreset) {
		trailer.select(preset);
		syncTrailer(preset);
		showCustomTrailer = false;
		trailerDropdownOpen = false;
		repackAfterTrailerChange();
	}

	function applyCustomTrailer() {
		const custom: TrailerPreset = { name: 'Custom', length: customLength, width: customWidth, height: customHeight, payloadLbs: 2500 };
		trailer.setCustom(customLength, customWidth, customHeight);
		syncTrailer(custom);
		showCustomTrailer = false;
		trailerDropdownOpen = false;
		repackAfterTrailerChange();
	}

	function repackAfterTrailerChange() {
		if (packedIds.size === 0) return;
		// Defer so currentTrailer has updated from the store subscription
		setTimeout(() => repack(), 0);
	}

	// Mobile bottom-sheet state — auto-opens when an item is selected
	let sheetState = $state<'peek' | 'full'>('peek');
	const SHEET_PEEK_H = 84;

	let isDesktop = $state(false);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(min-width: 768px)');
		isDesktop = mq.matches;
		const onChange = (e: MediaQueryListEvent) => { isDesktop = e.matches; };
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	$effect(() => {
		if (selectedItemIds.size > 0) sheetState = 'full';
	});

	trailer.subscribe((v) => currentTrailer = v);
	packResult.subscribe((v) => {
		result = v;
		if (v) {
			packedIds = new Set([
				...v.placed.map(p => p.item.id),
				...v.unplaced.map(u => u.id)
			]);
		}
	});
	inventory.subscribe((v) => items = v.filter(i => !i.forSale));

	let packSyncTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const snap = result;
		if (packSyncTimer) clearTimeout(packSyncTimer);
		packSyncTimer = setTimeout(() => {
			syncPackState(snap ? packResultToRemote(snap) : null);
		}, 1000);
	});

	function repack() {
		const toPack = items.filter(i => packedIds.has(i.id));
		if (toPack.length === 0) {
			packResult.set(null);
			return;
		}
		const res = packItems(toPack, currentTrailer);
		packResult.set(res);
		loadOrderStep.set(0);
	}

	function addItem(id: string) {
		packedIds = new Set([...packedIds, id]);
		repack();
	}

	function removeItem(id: string) {
		const next = new Set(packedIds);
		next.delete(id);
		packedIds = next;
		if (primarySelectedId === id) primarySelectedId = null;
		const nextSel = new Set(selectedItemIds);
		nextSel.delete(id);
		selectedItemIds = nextSel;
		stackOrder = stackOrder.filter(s => s !== id);
		repack();
	}

	/** Unified select handler for both 3D canvas clicks and sidebar list clicks */
	function handleSelect(id: string, shift: boolean) {
		if (shift) {
			// Shift-click: multi-select
			snapTargetId = null;
			const next = new Set(selectedItemIds);
			if (next.has(id)) {
				next.delete(id);
				if (primarySelectedId === id) primarySelectedId = [...next].pop() ?? null;
			} else {
				next.add(id);
				primarySelectedId = id;
			}
			selectedItemIds = next;
		} else if (primarySelectedId && primarySelectedId !== id && selectedItemIds.has(primarySelectedId)) {
			// Click a different item while one is selected → snap target mode
			// (toggle off if clicking the already-set target)
			snapTargetId = snapTargetId === id ? null : id;
		} else {
			// First click, re-click same item (deselect), or no current selection
			snapTargetId = null;
			if (selectedItemIds.size === 1 && selectedItemIds.has(id)) {
				// Re-clicking the only selected item deselects it
				selectedItemIds = new Set();
				primarySelectedId = null;
			} else {
				selectedItemIds = new Set([id]);
				primarySelectedId = id;
			}
		}
		stackOrder = [...selectedItemIds];
	}

	function handleItemClick(id: string, shift = false) {
		const isPacked = liveResult?.placed.some(p => p.item.id === id);
		if (!isPacked) {
			addItem(id);
		} else {
			handleSelect(id, shift);
		}
	}

	const liveResult = $derived.by(() => {
		if (!result) return null;
		const itemMap = new Map(items.map(i => [i.id, i]));
		// Recompute room→color from the current live item list so colors are always
		// room-based even when loading a saved pack result with old index-based colors.
		const roomColors = buildRoomColorMap(items);
		return {
			...result,
			placed: result.placed
				.filter(p => itemMap.has(p.item.id))
				.map(p => {
					const freshItem = itemMap.get(p.item.id)!;
					return {
						...p,
						item: freshItem,
						color: roomColors.get(freshItem.room ?? '') ?? p.color
					};
				}),
			unplaced: result.unplaced
				.map(u => itemMap.get(u.id) ?? u)
				.filter(Boolean)
		} as PackResult;
	});

	const selectedPacked = $derived(
		liveResult?.placed.find(p => p.item.id === primarySelectedId) ?? null
	);

	const snapTargetPacked = $derived(
		snapTargetId ? liveResult?.placed.find(p => p.item.id === snapTargetId) ?? null : null
	);

	/** All packed items in the current selection (for multi UI) */
	const selectedPackedItems = $derived(
		liveResult?.placed.filter(p => selectedItemIds.has(p.item.id)) ?? []
	);

	/** True when 2+ selected items share the same x/z footprint (within 1 inch tolerance) */
	const isStacked = $derived.by(() => {
		if (selectedItemIds.size < 2 || !result) return false;
		const sel = result.placed.filter(p => selectedItemIds.has(p.item.id));
		if (sel.length < 2) return false;
		const ref = sel[0];
		const TOL = 1;
		return sel.every(p =>
			Math.abs(p.position.x - ref.position.x) < TOL &&
			Math.abs(p.position.z - ref.position.z) < TOL
		);
	});

	function shapeLabel(shape: string | undefined): string {
		return SHAPE_OPTIONS.find(s => s.value === shape)?.label ?? 'Box';
	}

	function shapeIcon(shape: string | undefined): string {
		return SHAPE_OPTIONS.find(s => s.value === shape)?.icon ?? '📦';
	}

	type SnapDir = 'left' | 'right' | 'front' | 'behind' | 'above';

	function snapItem(targetId: string, direction: SnapDir) {
		if (!result || !primarySelectedId) return;
		const src = result.placed.find(p => p.item.id === primarySelectedId);
		const tgt = result.placed.find(p => p.item.id === targetId);
		if (!src || !tgt) return;

		const newPos = { ...src.position };

		switch (direction) {
			case 'left':
				newPos.x = tgt.position.x - src.rotation.l;
				newPos.y = tgt.position.y;
				newPos.z = tgt.position.z;
				break;
			case 'right':
				newPos.x = tgt.position.x + tgt.rotation.l;
				newPos.y = tgt.position.y;
				newPos.z = tgt.position.z;
				break;
			case 'front':
				newPos.x = tgt.position.x;
				newPos.y = tgt.position.y;
				newPos.z = tgt.position.z + tgt.rotation.w;
				break;
			case 'behind':
				newPos.x = tgt.position.x;
				newPos.y = tgt.position.y;
				newPos.z = tgt.position.z - src.rotation.w;
				break;
			case 'above':
				newPos.x = tgt.position.x;
				newPos.y = tgt.position.y + tgt.rotation.h;
				newPos.z = tgt.position.z;
				break;
		}

		const maxX = currentTrailer.length * 12 - src.rotation.l;
		const maxY = currentTrailer.height * 12 - src.rotation.h;
		const maxZ = currentTrailer.width * 12 - src.rotation.w;

		newPos.x = Math.max(0, Math.min(maxX, newPos.x));
		newPos.y = Math.max(0, Math.min(maxY, newPos.y));
		newPos.z = Math.max(0, Math.min(maxZ, newPos.z));

		const updated: PackResult = {
			...result,
			placed: result.placed.map(p =>
				p.item.id === primarySelectedId ? { ...p, position: newPos } : p
			)
		};
		packResult.set(updated);
	}

	const CU_IN_PER_CU_FT = 1728;
	const containerCuFt = $derived(currentTrailer.length * currentTrailer.width * currentTrailer.height);
	const usedCuFt = $derived.by(() => {
		if (!result) return 0;
		return result.placed.reduce((s, p) => s + (p.rotation.l * p.rotation.w * p.rotation.h) / CU_IN_PER_CU_FT, 0);
	});
	const spaceLeftCuFt = $derived(Math.max(0, containerCuFt - usedCuFt));
	const volBarPct = $derived(result ? Math.min(100, Math.max(0, result.utilization)) : 0);
	const payloadLbs = $derived(Math.max(1, currentTrailer.payloadLbs ?? 2500));
	const placedWeightLbs = $derived.by(() => {
		if (!result) return 0;
		return result.placed.reduce((s, p) => s + (p.item.weight ?? 0), 0);
	});
	const weightUtilPct = $derived(payloadLbs > 0 ? (placedWeightLbs / payloadLbs) * 100 : 0);
	const weightBarPct = $derived(Math.min(100, Math.max(0, weightUtilPct)));
	const weightLeftLbs = $derived(payloadLbs - placedWeightLbs);
	const placedWithoutWeight = $derived.by(() => {
		if (!result) return 0;
		return result.placed.filter(p => p.item.weight == null || p.item.weight <= 0).length;
	});
	function fmtCuFt(n: number): string {
		return n >= 10 ? `${Math.round(n)}` : `${Math.round(n * 10) / 10}`;
	}

	const packedCount = $derived(liveResult?.placed.length ?? 0);

	// Captures initial positions of all selected items at drag-start for group drag
	const dragInitialPositions = new Map<string, { x: number; y: number; z: number }>();

	function handleDragStart(id: string) {
		if (!result) return;
		dragInitialPositions.clear();
		for (const p of result.placed) {
			if (selectedItemIds.has(p.item.id)) {
				dragInitialPositions.set(p.item.id, { ...p.position });
			}
		}
	}

	function moveItem(id: string, position: { x: number; y: number; z: number }) {
		if (!result) return;

		// Multi-item drag: apply the same delta to all selected items
		if (selectedItemIds.size > 1 && selectedItemIds.has(id)) {
			const primaryInit = dragInitialPositions.get(id);
			if (primaryInit) {
				const dx = position.x - primaryInit.x;
				const dz = position.z - primaryInit.z;
				const newPlaced = result.placed.map(p => {
					if (!selectedItemIds.has(p.item.id)) return p;
					const init = dragInitialPositions.get(p.item.id);
					if (!init) return p;
					const maxX = currentTrailer.length * 12 - p.rotation.l;
					const maxZ = currentTrailer.width * 12 - p.rotation.w;
					return {
						...p,
						position: {
							x: Math.max(0, Math.min(maxX, init.x + dx)),
							y: p.position.y,
							z: Math.max(0, Math.min(maxZ, init.z + dz)),
						}
					};
				});
				packResult.set({ ...result, placed: newPlaced });
				return;
			}
		}

		// Single item move with collision check
		const self = result.placed.find(p => p.item.id === id);
		if (!self) return;
		if (packedItemCollidesWithAnyPeer(id, position, self.rotation, result.placed)) return;
		packResult.set({
			...result,
			placed: result.placed.map(p => p.item.id === id ? { ...p, position } : p)
		});
	}

	/** Stack selected items vertically at the base item's x/z. */
	function stackItems() {
		if (!result || selectedItemIds.size < 2) return;
		const placed = result.placed;

		// stackOrder[0] = top, stackOrder[last] = bottom
		const order = stackOrder.length === selectedItemIds.size
			? stackOrder
			: [...selectedItemIds];

		// Base x/z: use primary item or first in order
		const baseId = order[order.length - 1] ?? [...selectedItemIds][0];
		const base = placed.find(p => p.item.id === baseId);
		if (!base) return;

		const baseX = base.position.x;
		const baseZ = base.position.z;

		// Stack from floor up: last in order (bottom) → first (top)
		const bottomToTop = [...order].reverse();
		let y = 0;
		const newPositions = new Map<string, { x: number; y: number; z: number }>();
		for (const sid of bottomToTop) {
			const p = placed.find(pr => pr.item.id === sid);
			if (!p) continue;
			newPositions.set(sid, { x: baseX, y, z: baseZ });
			y += p.rotation.h;
		}

		packResult.set({
			...result,
			placed: result.placed.map(p =>
				newPositions.has(p.item.id)
					? { ...p, position: newPositions.get(p.item.id)! }
					: p
			)
		});
	}

	/** Swap two items in stackOrder and re-stack if already stacked. */
	function reorderStack(fromIdx: number, toIdx: number) {
		if (fromIdx === toIdx) return;
		const next = [...stackOrder];
		const [moved] = next.splice(fromIdx, 1);
		next.splice(toIdx, 0, moved);
		stackOrder = next;
		if (isStacked) stackItems();
	}

	const NUDGE_SMALL = 1;   // inches
	const NUDGE_LARGE = 6;

	function nudgeItem(axis: 'x' | 'y' | 'z', delta: number) {
		if (!result || selectedItemIds.size === 0) return;

		const selected = result.placed.filter(p => selectedItemIds.has(p.item.id));
		if (selected.length === 0) return;

		// Non-selected items to check collisions against
		const nonSelected = result.placed.filter(p => !selectedItemIds.has(p.item.id));
		const proposed = new Map<string, { x: number; y: number; z: number }>();

		for (const src of selected) {
			const maxX = currentTrailer.length * 12 - src.rotation.l;
			const maxY = currentTrailer.height * 12 - src.rotation.h;
			const maxZ = currentTrailer.width * 12 - src.rotation.w;

			const newPos = { ...src.position };
			newPos[axis] = Math.max(0, Math.min(
				axis === 'x' ? maxX : axis === 'y' ? maxY : maxZ,
				newPos[axis] + delta
			));

			if (packedItemCollidesWithAnyPeer(src.item.id, newPos, src.rotation, nonSelected)) {
				return; // Abort entire group move if any item would collide
			}
			proposed.set(src.item.id, newPos);
		}

		packResult.set({
			...result,
			placed: result.placed.map(p => {
				const np = proposed.get(p.item.id);
				return np ? { ...p, position: np } : p;
			})
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (selectedItemIds.size === 0) return;
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

		const step = e.shiftKey ? NUDGE_LARGE : NUDGE_SMALL;

		switch (e.key) {
			case 'ArrowLeft':
				nudgeItem('x', -step);
				break;
			case 'ArrowRight':
				nudgeItem('x', step);
				break;
			case 'ArrowUp':
				nudgeItem(e.altKey ? 'y' : 'z', e.altKey ? step : -step);
				break;
			case 'ArrowDown':
				nudgeItem(e.altKey ? 'y' : 'z', e.altKey ? -step : step);
				break;
			case 'Escape':
				if (snapTargetId) {
					snapTargetId = null;
				} else {
					selectedItemIds = new Set();
					primarySelectedId = null;
				}
				break;
			default:
				return;
		}
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Mover — Pack Planner</title>
</svelte:head>

<div class="packer-page">
	<!-- Left sidebar (desktop) / bottom sheet (mobile) -->
	<div class="left-panel">
		<BottomSheet bind:value={sheetState} peekHeight={SHEET_PEEK_H}>

		<!-- Peek summary: packer status pill (mobile only) -->
		{#if !isDesktop}
		<div class="peek-pills" role="button" tabindex="0"
			onclick={() => sheetState = 'full'}
			onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') sheetState = 'full'; }}
			aria-label="Expand planner"
		>
			<div class="peek-pill peek-pill--packer">
				<div class="peek-pill-body">
					<span class="peek-pill-count">{packedCount}/{items.length} packed</span>
					<div class="peek-progress-bar">
						<div class="peek-progress-fill" style:width="{volBarPct}%"></div>
					</div>
				</div>
				<div class="peek-pill-icon">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
					</svg>
				</div>
			</div>
		</div>
		{/if}

		{#if isDesktop || sheetState === 'full'}
		<div class="packer-header">
			<h1>Pack Planner</h1>
		</div>

		{#if !primarySelectedId && selectedItemIds.size < 2}
		<div class="packer-tabs">
			<button class="packer-tab" class:active={activeTab === 'inventory'} onclick={() => activeTab = 'inventory'}>
				Inventory
			</button>
			<button class="packer-tab" class:active={activeTab === 'stats'} onclick={() => activeTab = 'stats'}>
				Stats
			</button>
		</div>
		{/if}

		<div class="panel-scroll">
			{#if activeTab === 'stats'}
				<div class="stats-panel">
					{#if result}
						<div class="pack-stats">
							<div class="pack-stat">
								<span class="pack-stat-val">{result.placed.length}</span>
								<span class="pack-stat-label">Placed</span>
							</div>
							<div class="pack-stat">
								<span class="pack-stat-val warn">{result.unplaced.length}</span>
								<span class="pack-stat-label">Won't fit</span>
							</div>
						</div>

						<div class="pack-bars">
							<div class="cap-bar-block">
								<div class="cap-bar-header">
									<span class="cap-bar-title">Space</span>
									<span class="cap-bar-meta">
										{result.utilization}% used · <strong>{fmtCuFt(spaceLeftCuFt)} cu ft</strong> left
									</span>
								</div>
								<div class="cap-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, result.utilization))} aria-label="Trailer space used">
									<div class="cap-bar-fill vol" style:width="{volBarPct}%"></div>
								</div>
							</div>

							<div class="cap-bar-block">
								<div class="cap-bar-header">
									<span class="cap-bar-title">Weight</span>
									<span class="cap-bar-meta">
										{Math.round(placedWeightLbs)} / {payloadLbs} lbs
										{#if weightLeftLbs >= 0}
											· <strong>{Math.round(weightLeftLbs)} lbs</strong> left
										{:else}
											· <strong class="over">{Math.round(-weightLeftLbs)} lbs</strong> over
										{/if}
									</span>
								</div>
								<div class="cap-bar-track" class:over-cap={weightUtilPct > 100} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, weightUtilPct))} aria-label="Trailer weight versus payload limit">
									<div class="cap-bar-fill weight" style:width="{weightBarPct}%"></div>
								</div>
								{#if placedWithoutWeight > 0}
									<p class="cap-bar-hint">{placedWithoutWeight} item{placedWithoutWeight === 1 ? '' : 's'} missing weight</p>
								{/if}
							</div>
						</div>

						{#if result.unplaced.length > 0}
							<div class="unplaced-list">
								<p class="unplaced-title">Items that didn't fit:</p>
								{#each result.unplaced as item}
									<span class="unplaced-item">{item.name}</span>
								{/each}
							</div>
						{/if}
					{:else}
						<div class="stats-empty">
							<p>Add items to the trailer to see stats</p>
						</div>
					{/if}
				</div>
			{:else}

			{#if selectedItemIds.size >= 2}
				<!-- Multi-select card — same container as single-item detail -->
				<div class="detail-card">
					<div class="detail-card-header">
						<span class="multi-select-title">{selectedItemIds.size} items selected</span>
						<button
							class="detail-close"
							onclick={() => { selectedItemIds = new Set(); primarySelectedId = null; }}
							aria-label="Deselect all"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					<div class="stack-order-list">
						{#each stackOrder as id, idx (id)}
							{@const p = liveResult?.placed.find(pl => pl.item.id === id)}
							{#if p}
								<div class="stack-order-row">
									<div class="stack-order-reorder">
										<button
											class="reorder-btn"
											disabled={idx === 0}
											onclick={() => reorderStack(idx, idx - 1)}
											title="Move up"
										>▲</button>
										<button
											class="reorder-btn"
											disabled={idx === stackOrder.length - 1}
											onclick={() => reorderStack(idx, idx + 1)}
											title="Move down"
										>▼</button>
									</div>
									<span class="stack-order-dot" style:background={p.color}></span>
									<span class="stack-order-name">{p.item.name}</span>
									<span class="stack-order-badge">
										{#if idx === 0}top{:else if idx === stackOrder.length - 1}bottom{/if}
									</span>
								</div>
							{/if}
						{/each}
					</div>

					<div class="multi-actions">
						<button class="multi-action-btn primary" onclick={stackItems}>
							{isStacked ? '↕ Re-stack' : '↕ Stack vertically'}
						</button>
					</div>

					<p class="stack-hint">
						{isStacked
							? 'Drag to move the group · reorder above to rearrange'
							: 'Drag any item to move the group · shift-click to add/remove'}
					</p>
				</div>
			{:else if selectedPacked}
				{@const item = selectedPacked.item}
				<div class="detail-card">
					<div class="detail-card-header">
						<div
							class="detail-color-dot"
							style:background={selectedPacked.color}
						></div>
						<h3 class="detail-card-name">{item.name}</h3>
					<button
						class="detail-close"
						onclick={() => { selectedItemIds = new Set(); primarySelectedId = null; snapTargetId = null; }}
						aria-label="Close detail"
					>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					{#if item.photo}
						<div class="detail-photo">
							<img src={item.photo} alt={item.name} />
						</div>
					{/if}

					<div class="detail-meta">
						<div class="meta-row">
							<span class="meta-label">Dimensions</span>
							<span class="meta-value">{item.dimensions.l}″ × {item.dimensions.w}″ × {item.dimensions.h}″</span>
						</div>
						<div class="meta-row">
							<span class="meta-label">Packed as</span>
							<span class="meta-value">{selectedPacked.rotation.l}″ × {selectedPacked.rotation.w}″ × {selectedPacked.rotation.h}″</span>
						</div>
						{#if item.weight}
							<div class="meta-row">
								<span class="meta-label">Weight</span>
								<span class="meta-value">{item.weight} lbs</span>
							</div>
						{/if}
						<div class="meta-row">
							<span class="meta-label">Shape</span>
							<span class="meta-value">{shapeIcon(item.shape)} {shapeLabel(item.shape)}</span>
						</div>
					</div>

					<div class="detail-badges">
						{#if item.forSale}
							<span class="badge badge-sale">💲 For Sale</span>
						{/if}
						{#if item.donate}
							<span class="badge badge-donate">📦 Donate</span>
						{/if}
						{#if item.fragile}
							<span class="badge badge-warn">⚠️ Fragile</span>
						{/if}
						{#if !item.stackable}
							<span class="badge badge-warn">🚫 No Stack</span>
						{/if}
						{#if item.stackable}
							<span class="badge badge-ok">✓ Stackable</span>
						{/if}
					</div>

					{#if item.contents.length > 0}
						<div class="detail-section">
							<span class="detail-section-label">Contents ({item.contents.length})</span>
							<ul class="contents-list">
								{#each item.contents as c}
									<li>{#if c.important}⭐ {/if}{c.text}</li>
								{/each}
							</ul>
						</div>
					{/if}

				{#if item.notes}
					<div class="detail-section">
						<span class="detail-section-label">Notes</span>
						<p class="detail-notes">{item.notes}</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if items.length > 0 && !primarySelectedId && selectedItemIds.size < 2}
				<details class="accordion" open>
					<summary class="accordion-trigger">
						<span class="section-label">Inventory ({items.length})</span>
						<span class="accordion-hint">{packedIds.size} in trailer</span>
						<svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
					</summary>
					<div class="accordion-body">
						<div class="inv-actions">
							{#if packedIds.size < items.length}
								<button class="add-all-btn" onclick={() => { packedIds = new Set(items.map(i => i.id)); repack(); }}>Add all</button>
							{/if}
							{#if packedIds.size > 0}
								<button class="add-all-btn" onclick={() => { packedIds = new Set(); packResult.set(null); }}>Clear</button>
							{/if}
						</div>
						<div class="item-list">
							{#each items as item (item.id)}
							{@const packed = liveResult?.placed.find(p => p.item.id === item.id)}
							{@const unplaced = liveResult?.unplaced.find(u => u.id === item.id)}
							{@const noDims = item.dimensions.l <= 0 || item.dimensions.w <= 0 || item.dimensions.h <= 0}
							{@const inTrailer = packedIds.has(item.id)}
							<div
								class="item-row"
								class:packed={!!packed}
								class:unplaced={!!unplaced || noDims}
								class:selected={selectedItemIds.has(item.id)}
								role="button"
								tabindex="0"
								onclick={(e) => handleItemClick(item.id, e.shiftKey)}
								onkeydown={(e) => { if (e.key === 'Enter') handleItemClick(item.id); }}
							>
									<span
										class="item-dot"
										style:background={packed?.color ?? ((unplaced || noDims) ? 'var(--color-warning)' : 'var(--color-border)')}
									></span>
									<span class="item-name">{item.name}</span>
									<span class="item-dims">
										{#if noDims}
											<em style="color: var(--color-warning); font-style: normal;">No dimensions</em>
										{:else}
											{item.dimensions.l}×{item.dimensions.w}×{item.dimensions.h}″
										{/if}
									</span>
									{#if inTrailer}
										<button
											class="item-remove"
											onclick={(e) => { e.stopPropagation(); removeItem(item.id); }}
											aria-label="Remove from trailer"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
										</button>
									{:else}
										<span class="item-add-hint">
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
										</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</details>
		{/if}
		{/if}
		</div>
		{/if}
		</BottomSheet>
	</div>

	<!-- Right: 3D scene -->
	<div class="right-panel">
		<!-- Floating trailer dropdown (top-right) -->
		<div class="trailer-float">
			<button class="trailer-float-btn" onclick={() => trailerDropdownOpen = !trailerDropdownOpen}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
					<path d="M16 8h4l3 3v5h-7V8z"/>
					<circle cx="5.5" cy="18.5" r="2.5"/>
					<circle cx="18.5" cy="18.5" r="2.5"/>
				</svg>
				<span>{currentTrailer.name}</span>
				<svg class="trailer-float-chevron" class:open={trailerDropdownOpen} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
			</button>
			{#if trailerDropdownOpen}
				<button class="trailer-float-backdrop" onclick={() => { trailerDropdownOpen = false; showCustomTrailer = false; }} aria-label="Close dropdown"></button>
				<div class="trailer-dropdown">
					{#each TRAILER_PRESETS as preset}
						<button
							class="trailer-option"
							class:active={currentTrailer.name === preset.name}
							onclick={() => selectPreset(preset)}
						>
							<span class="trailer-option-name">{preset.name}</span>
							<span class="trailer-option-dims">{preset.length}' × {preset.width}' × {preset.height}'</span>
						</button>
					{/each}
					<button
						class="trailer-option"
						class:active={currentTrailer.name === 'Custom'}
						onclick={() => showCustomTrailer = !showCustomTrailer}
					>
						<span class="trailer-option-name">Custom</span>
						<span class="trailer-option-dims">Set your own</span>
					</button>
					{#if showCustomTrailer}
						<div class="trailer-custom-row">
							<label class="trailer-custom-field">
								<span>L</span>
								<input type="number" bind:value={customLength} min="1" step="0.5" inputmode="decimal" />
							</label>
							<label class="trailer-custom-field">
								<span>W</span>
								<input type="number" bind:value={customWidth} min="1" step="0.5" inputmode="decimal" />
							</label>
							<label class="trailer-custom-field">
								<span>H</span>
								<input type="number" bind:value={customHeight} min="1" step="0.5" inputmode="decimal" />
							</label>
							<button class="trailer-custom-apply" onclick={applyCustomTrailer}>Set</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="scene-area">
			<label class="scene-texture-toggle" title="Maps each item’s photo onto its shape model (couch, chair, box, etc.). Does not replace 3D scans from photos.">
				<input type="checkbox" bind:checked={wrapPhotoOnShapes} />
				<span>Photo on shapes</span>
			</label>
			<TrailerScene
				trailer={currentTrailer}
				packedItems={liveResult?.placed ?? []}
				loadStep={0}
				{selectedItemIds}
				{snapTargetId}
				{wrapPhotoOnShapes}
				onSelectItem={handleSelect}
				onClickEmpty={() => { selectedItemIds = new Set(); primarySelectedId = null; snapTargetId = null; }}
				onDragStart={handleDragStart}
				onMoveItem={moveItem}
			/>
		</div>

		<!-- Mobile detail drawer -->
		{#if selectedItemIds.size >= 2}
			<div class="mobile-detail">
				<div class="detail-card">
					<div class="detail-card-header">
						<span class="multi-select-title">{selectedItemIds.size} items selected</span>
						<button class="detail-close" onclick={() => { selectedItemIds = new Set(); primarySelectedId = null; }} aria-label="Deselect all">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					<div class="stack-order-list">
						{#each stackOrder as id, idx (id)}
							{@const p = liveResult?.placed.find(pl => pl.item.id === id)}
							{#if p}
								<div class="stack-order-row">
									<div class="stack-order-reorder">
										<button class="reorder-btn" disabled={idx === 0} onclick={() => reorderStack(idx, idx - 1)} title="Move up">▲</button>
										<button class="reorder-btn" disabled={idx === stackOrder.length - 1} onclick={() => reorderStack(idx, idx + 1)} title="Move down">▼</button>
									</div>
									<span class="stack-order-dot" style:background={p.color}></span>
									<span class="stack-order-name">{p.item.name}</span>
									<span class="stack-order-badge">
										{#if idx === 0}top{:else if idx === stackOrder.length - 1}bottom{/if}
									</span>
								</div>
							{/if}
						{/each}
					</div>

					<div class="multi-actions">
						<button class="multi-action-btn primary" onclick={stackItems}>
							{isStacked ? '↕ Re-stack' : '↕ Stack vertically'}
						</button>
					</div>

					<p class="stack-hint">
						{isStacked
							? 'Drag to move the group · reorder above to rearrange'
							: 'Drag any item to move the group · shift-click to add/remove'}
					</p>
				</div>
			</div>
		{:else if selectedPacked}
			{@const item = selectedPacked.item}
			<div class="mobile-detail">
				<div class="detail-card">
					<div class="detail-card-header">
						<div class="detail-color-dot" style:background={selectedPacked.color}></div>
						<h3 class="detail-card-name">{item.name}</h3>
						<button class="detail-close" onclick={() => { selectedItemIds = new Set(); primarySelectedId = null; }} aria-label="Close detail">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>

					{#if item.photo}
						<div class="detail-photo">
							<img src={item.photo} alt={item.name} />
						</div>
					{/if}

					<div class="detail-meta">
						<div class="meta-row">
							<span class="meta-label">Dimensions</span>
							<span class="meta-value">{item.dimensions.l}″ × {item.dimensions.w}″ × {item.dimensions.h}″</span>
						</div>
						<div class="meta-row">
							<span class="meta-label">Packed as</span>
							<span class="meta-value">{selectedPacked.rotation.l}″ × {selectedPacked.rotation.w}″ × {selectedPacked.rotation.h}″</span>
						</div>
						{#if item.weight}
							<div class="meta-row">
								<span class="meta-label">Weight</span>
								<span class="meta-value">{item.weight} lbs</span>
							</div>
						{/if}
						<div class="meta-row">
							<span class="meta-label">Shape</span>
							<span class="meta-value">{shapeIcon(item.shape)} {shapeLabel(item.shape)}</span>
						</div>
					</div>

					<div class="detail-badges">
						{#if item.forSale}
							<span class="badge badge-sale">💲 For Sale</span>
						{/if}
						{#if item.donate}
							<span class="badge badge-donate">📦 Donate</span>
						{/if}
						{#if item.fragile}
							<span class="badge badge-warn">⚠️ Fragile</span>
						{/if}
						{#if !item.stackable}
							<span class="badge badge-warn">🚫 No Stack</span>
						{/if}
						{#if item.stackable}
							<span class="badge badge-ok">✓ Stackable</span>
						{/if}
					</div>

					{#if item.contents.length > 0}
						<div class="detail-section">
							<span class="detail-section-label">Contents ({item.contents.length})</span>
							<ul class="contents-list">
								{#each item.contents as c}
									<li>{#if c.important}⭐ {/if}{c.text}</li>
								{/each}
							</ul>
						</div>
					{/if}

			{#if item.notes}
				<div class="detail-section">
					<span class="detail-section-label">Notes</span>
					<p class="detail-notes">{item.notes}</p>
				</div>
			{/if}
			</div>
		</div>
	{/if}

	<!-- Floating move/snap controls — bottom-right of scene -->
	{#if selectedPacked && selectedItemIds.size === 1}
		<div class="move-float">
			{#if snapTargetPacked}
				<div class="snap-to-header">
					<span class="snap-to-label">Place next to</span>
					<span class="snap-to-target" style:border-left="3px solid {snapTargetPacked.color}">
						{snapTargetPacked.item.name}
					</span>
					<button class="snap-to-clear" onclick={() => snapTargetId = null} aria-label="Exit snap mode">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
				<div class="snap-directions">
					<button class="snap-dir-btn" onclick={() => snapItem(snapTargetId!, 'left')} title="Left of">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
						Left
					</button>
					<button class="snap-dir-btn" onclick={() => snapItem(snapTargetId!, 'right')} title="Right of">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
						Right
					</button>
					<button class="snap-dir-btn" onclick={() => snapItem(snapTargetId!, 'behind')} title="Behind">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
						Behind
					</button>
					<button class="snap-dir-btn" onclick={() => snapItem(snapTargetId!, 'front')} title="In front">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
						Front
					</button>
					<button class="snap-dir-btn snap-dir-above" onclick={() => snapItem(snapTargetId!, 'above')} title="Stack on top">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
						Above
					</button>
				</div>
			{:else}
				<div class="nudge-grid">
					<button class="nudge-btn" onclick={() => nudgeItem('z', -NUDGE_LARGE)} title="Forward (↑)">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
					</button>
					<button class="nudge-btn nudge-btn--up" onclick={() => nudgeItem('y', NUDGE_LARGE)} title="Up (Alt+↑)">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
					</button>
					<button class="nudge-btn" onclick={() => nudgeItem('x', -NUDGE_LARGE)} title="Left (←)">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
					</button>
					<button class="nudge-btn nudge-btn--center" onclick={() => nudgeItem('z', NUDGE_LARGE)} title="Back (↓)">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
					</button>
					<button class="nudge-btn" onclick={() => nudgeItem('x', NUDGE_LARGE)} title="Right (→)">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
				<p class="nudge-hint">Click another item to snap</p>
			{/if}
		</div>
	{/if}
	</div>
</div>

<style>
	/* ---- Mobile-first (stacked) ---- */
	.packer-page {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.left-panel {
		display: contents;
	}

	/* On mobile: panel-scroll IS the scroll container (sheet-body is overflow:hidden) */
	.panel-scroll {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	/* ── Peek-state packer pill ────────────────────────────────────── */
	.peek-pills {
		display: flex;
		padding: 2px 14px 6px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.peek-pill {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.peek-pill-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.peek-pill-count {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text);
	}

	.peek-progress-bar {
		height: 4px;
		background: var(--color-border-subtle);
		border-radius: 100px;
		overflow: hidden;
	}

	.peek-progress-fill {
		height: 100%;
		background: var(--color-accent);
		border-radius: 100px;
		transition: width 0.3s ease;
	}

	.peek-pill-icon {
		flex-shrink: 0;
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.packer-header {
		padding: 0 16px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		/* Height = peekHeight(80) - handle(22) so text centres in the visible mini-card */
		height: 58px;
	}

	.packer-header h1 {
		font-size: 28px;
		font-weight: 700;
	}

	.packer-tabs {
		display: flex;
		gap: 4px;
		padding: 0 16px 8px;
		flex-shrink: 0;
	}

	.packer-tab {
		flex: 1;
		padding: 8px 0;
		font-size: 13px;
		font-weight: 600;
		text-align: center;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		position: relative;
	}

	.packer-tab.active {
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
	}

	.packer-tab:not(.active):hover {
		color: var(--color-text-secondary);
	}

	.right-panel {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.scene-area {
		flex: 1;
		min-height: 250px;
		position: relative;
		background: var(--color-bg);
	}

	.scene-texture-toggle {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 12px;
		cursor: pointer;
		user-select: none;
		backdrop-filter: blur(8px);
		box-shadow: var(--shadow-sm);
	}

	.scene-texture-toggle:hover {
		color: var(--color-text-primary);
		border-color: var(--color-border-subtle);
	}

	.scene-texture-toggle input {
		margin: 0;
		accent-color: var(--color-accent, #e20074);
	}


	/* ---- Stats panel ---- */
	.stats-panel {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.stats-empty {
		padding: 32px 16px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 13px;
	}

	.pack-stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	.pack-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 14px 8px;
		background: var(--color-bg-card);
		border-radius: var(--radius-md);
	}

	.pack-stat-val {
		font-size: 28px;
		font-weight: 700;
		line-height: 1;
	}

	.pack-stat-val.warn {
		color: var(--color-warning);
	}

	.pack-stat-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.pack-bars {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.cap-bar-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cap-bar-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cap-bar-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.cap-bar-meta {
		font-size: 13px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}

	.cap-bar-meta strong {
		color: var(--color-text-primary);
		font-weight: 600;
	}

	.cap-bar-meta .over {
		color: var(--color-danger);
	}

	.cap-bar-track {
		height: 8px;
		border-radius: 100px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}

	.cap-bar-track.over-cap {
		box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.45);
	}

	.cap-bar-fill {
		height: 100%;
		border-radius: 100px;
		transition: width 0.25s ease;
	}

	.cap-bar-fill.vol {
		background: linear-gradient(90deg, #9a9a9a, #f0f0f0);
	}

	.cap-bar-fill.weight {
		background: linear-gradient(90deg, #22c55e, #4ade80);
	}

	.cap-bar-track.over-cap .cap-bar-fill.weight {
		background: linear-gradient(90deg, var(--color-danger), #f87171);
	}

	.cap-bar-hint {
		font-size: 11px;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.35;
	}

	.unplaced-list {
		padding: 12px;
		background: var(--color-warning-soft);
		border-radius: var(--radius-sm);
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.unplaced-title {
		width: 100%;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-warning);
		margin-bottom: 4px;
	}

	.unplaced-item {
		font-size: 12px;
		padding: 3px 8px;
		background: rgba(245, 158, 11, 0.2);
		border-radius: 4px;
		color: var(--color-warning);
	}

	/* ---- Floating trailer dropdown ---- */
	.trailer-float {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 15;
	}

	.trailer-float-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-primary);
		background: var(--color-bg-elevated);
		border: none;
		border-radius: var(--radius-pill);
		box-shadow:
			0 0 0 1px var(--color-border),
			var(--shadow-md);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		cursor: pointer;
		transition: background 0.15s;
	}

	.trailer-float-btn:hover {
		background: var(--color-bg-card);
	}

	.trailer-float-chevron {
		color: var(--color-text-muted);
		transition: transform 0.2s;
		flex-shrink: 0;
	}

	.trailer-float-chevron.open {
		transform: rotate(180deg);
	}

	.trailer-float-backdrop {
		position: fixed;
		inset: 0;
		z-index: 14;
		background: transparent;
		border: none;
		cursor: default;
	}

	.trailer-dropdown {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		min-width: 220px;
		z-index: 16;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px;
		background: var(--color-bg-elevated);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow:
			0 0 0 1px var(--color-border),
			var(--shadow-lg);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.trailer-option {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-primary);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.trailer-option:hover {
		background: var(--color-bg-card);
	}

	.trailer-option.active {
		background: var(--color-accent-soft);
	}

	.trailer-option-name {
		font-weight: 600;
	}

	.trailer-option-dims {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.trailer-custom-row {
		display: flex;
		gap: 6px;
		align-items: flex-end;
		padding: 8px 12px 6px;
	}

	.trailer-custom-field {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.trailer-custom-field span {
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.trailer-custom-field input {
		text-align: center;
		padding: 6px 4px;
		font-size: 13px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		color: var(--color-text-primary);
	}

	.trailer-custom-apply {
		padding: 6px 12px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 12px;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-sm);
		white-space: nowrap;
		cursor: pointer;
	}

	/* Selected item detail card */
	.detail-card {
		padding: 16px;
		border-top: 1px solid var(--color-divider);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.detail-card-header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.detail-color-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.detail-card-name {
		flex: 1;
		font-size: 16px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.detail-close {
		padding: 4px;
		color: var(--color-text-muted);
		border-radius: 4px;
		transition: color 0.15s;
		flex-shrink: 0;
	}

	.detail-close:hover {
		color: var(--color-text);
	}

	.detail-photo {
		border-radius: var(--radius-sm);
		overflow: hidden;
		max-height: 160px;
	}

	.detail-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.detail-meta {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.meta-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
	}

	.meta-label {
		color: var(--color-text-muted);
	}

	.meta-value {
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.detail-badges {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.badge {
		font-size: 11px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 4px;
	}

	.badge-warn {
		background: var(--color-warning-soft);
		color: var(--color-warning);
	}

	.badge-ok {
		background: var(--color-success-soft);
		color: var(--color-success);
	}

	.badge-sale {
		background: rgba(255, 255, 255, 0.08);
		color: #d4d4d4;
	}

	.badge-donate {
		background: rgba(255, 255, 255, 0.06);
		color: #a3a3a3;
	}

	.detail-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.detail-section-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.contents-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.contents-list li {
		font-size: 13px;
		padding: 6px 10px;
		background: var(--color-bg-card);
		border-radius: var(--radius-sm);
	}

	.detail-notes {
		font-size: 13px;
		color: var(--color-text-secondary);
		line-height: 1.5;
		padding: 8px 10px;
		background: var(--color-bg-card);
		border-radius: var(--radius-sm);
		margin: 0;
	}

	/* Inline nudge controls (default single-item state) */
	/* ── Floating move/snap panel — bottom-right of scene ── */
	.move-float {
		position: absolute;
		bottom: 12px;
		right: 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px 12px;
		background: var(--color-bg);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08);
		z-index: 10;
	}

	.nudge-grid {
		display: grid;
		grid-template-columns: repeat(3, 34px);
		grid-template-rows: repeat(2, 34px);
		gap: 3px;
	}

	.nudge-btn {
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg-elevated);
		color: var(--color-text-secondary);
		transition: all 0.12s;
	}

	.nudge-btn:hover {
		background: var(--color-bg-card);
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}

	.nudge-btn:active {
		background: var(--color-accent-soft);
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	/* The "up" button sits in the top-right of the 3×2 grid */
	.nudge-btn--up {
		grid-column: 3;
		grid-row: 1;
		color: var(--color-text-muted);
		border-style: dashed;
	}

	/* Back/down is the center of row 2 */
	.nudge-btn--center {
		grid-column: 2;
		grid-row: 2;
	}

	.nudge-hint {
		font-size: 10px;
		color: var(--color-text-muted);
		text-align: center;
	}

	.snap-to-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.snap-to-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.snap-to-target {
		flex: 1;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text);
		padding-left: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.snap-to-clear {
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		color: var(--color-text-muted);
		flex-shrink: 0;
		transition: all 0.12s;
	}

	.snap-to-clear:hover {
		background: var(--color-bg-elevated);
		color: var(--color-text);
	}

	.snap-directions {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.snap-dir-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 5px 9px;
		font-size: 11px;
		font-weight: 500;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg-elevated);
		color: var(--color-text-secondary);
		transition: all 0.12s;
		white-space: nowrap;
	}

	.snap-dir-btn:hover {
		background: var(--color-bg-card);
		border-color: var(--color-border-strong);
		color: var(--color-text);
	}

	.snap-dir-btn:active {
		background: var(--color-accent-soft);
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	.snap-dir-btn.snap-dir-above {
		border-style: dashed;
	}

	/* Inventory sidebar list */
	/* Accordion */
	.accordion {
		border: none;
		border-radius: var(--radius-lg);
		margin: 0 16px;
		overflow: hidden;
		background: var(--color-bg-card);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}

	.accordion-trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		cursor: pointer;
		list-style: none;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.accordion-trigger::-webkit-details-marker { display: none; }

	.accordion-trigger .section-label {
		margin-bottom: 0;
	}

	.accordion-hint {
		flex: 1;
		text-align: right;
		font-size: 11px;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.accordion-chevron {
		flex-shrink: 0;
		color: var(--color-text-muted);
		transition: transform 0.2s;
	}

	.accordion[open] > .accordion-trigger .accordion-chevron {
		transform: rotate(180deg);
	}

	.accordion-body {
		padding: 0 12px 12px;
	}

	.inv-actions {
		display: flex;
		gap: 8px;
		margin-bottom: 10px;
	}

	.add-all-btn {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-accent);
		padding: 6px 12px;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-bg-elevated);
		transition: background 0.2s ease;
	}

	.add-all-btn:active {
		background: var(--color-bg-card);
	}

	.section-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 10px;
	}

	.item-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		text-align: left;
		transition: background 0.15s;
		cursor: default;
	}

	.item-row.packed,
	.item-row:not(.packed):not(.unplaced) {
		cursor: pointer;
	}

	.item-row:hover {
		background: var(--color-bg-elevated);
	}

	.item-row.selected {
		background: var(--color-accent-soft);
	}

	.item-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.item-name {
		flex: 1;
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-row.unplaced .item-name {
		color: var(--color-warning);
	}

	.item-dims {
		font-size: 11px;
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.item-add-hint {
		color: var(--color-text-muted);
		opacity: 0.4;
		flex-shrink: 0;
		display: flex;
		transition: opacity 0.15s;
	}

	.item-row:hover .item-add-hint {
		opacity: 0.8;
	}

	.item-remove {
		padding: 2px;
		color: var(--color-text-muted);
		flex-shrink: 0;
		display: flex;
		border-radius: 4px;
		transition: color 0.15s;
	}

	.item-remove:hover {
		color: var(--color-danger);
	}

	/* Mobile detail drawer (slides up from bottom of scene) */
	.mobile-detail {
		max-height: 50vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		background: var(--color-bg);
		border-top: 1px solid var(--color-divider);
	}

	/* ---- Desktop: side-by-side ---- */
	@media (min-width: 768px) {
		.mobile-detail {
			display: none;
		}
		.packer-page {
			flex-direction: row;
		}

		.left-panel {
			display: flex;
			flex-direction: column;
			width: var(--sidebar-width);
			flex-shrink: 0;
			border-right: 1px solid var(--color-divider);
			background: var(--color-bg);
			overflow: hidden;
		}

		/* On desktop the BottomSheet is static — panel-scroll scrolls independently */
		.panel-scroll {
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}

	.right-panel {
		flex: 1;
		min-width: 0;
	}
}

/* ---- Multi-select / stack — shared title inside detail-card ---- */
.multi-select-title {
	font-size: 13px;
	font-weight: 600;
	color: var(--color-text-primary);
	flex: 1;
}

.stack-order-list {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.stack-order-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 5px 6px;
	border-radius: var(--radius-sm);
	background: var(--color-bg-card);
}

.stack-order-reorder {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.reorder-btn {
	background: none;
	border: none;
	cursor: pointer;
	font-size: 9px;
	line-height: 1.1;
	color: var(--color-text-muted);
	padding: 1px 3px;
	border-radius: 3px;
}
.reorder-btn:hover:not(:disabled) { color: var(--color-text-primary); background: var(--color-bg-elevated); }
.reorder-btn:disabled { opacity: 0.25; cursor: default; }

.stack-order-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.stack-order-name {
	flex: 1;
	font-size: 12px;
	color: var(--color-text-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.stack-order-badge {
	font-size: 10px;
	color: var(--color-text-muted);
	font-weight: 500;
	min-width: 36px;
	text-align: right;
}

.multi-actions {
	display: flex;
	gap: 8px;
}

.multi-action-btn {
	flex: 1;
	padding: 7px 10px;
	border: none;
	border-radius: var(--radius-sm);
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s;
}
.multi-action-btn.primary {
	background: var(--color-accent);
	color: #fff;
}
.multi-action-btn.primary:hover {
	opacity: 0.85;
}

.stack-hint {
	font-size: 11px;
	color: var(--color-text-muted);
	margin: 0;
	line-height: 1.4;
}
</style>
