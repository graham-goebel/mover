<script lang="ts">
	import type { PackedItem, TrailerPreset, PackResult, InventoryItem } from '$lib/types';
	import { trailer, packResult, loadOrderStep, TRAILER_PRESETS } from '$lib/stores/trailer';
	import { inventory } from '$lib/stores/inventory';
	import { packItems } from '$lib/utils/packing';
	import { SHAPE_OPTIONS } from '$lib/utils/shapes';
	import TrailerScene from '$lib/components/TrailerScene.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';

	let currentTrailer = $state<TrailerPreset>({ ...TRAILER_PRESETS[2] });
	let result = $state<PackResult | null>(null);
	let step = $state(0);
	let selectedItemId = $state<string | null>(null);
	let items = $state<InventoryItem[]>([]);
	let packedIds = $state(new Set<string>());

	type PackerTab = 'inventory' | 'stats';
	let activeTab = $state<PackerTab>('inventory');

	let trailerDropdownOpen = $state(false);
	let showCustomTrailer = $state(false);
	let customLength = $state(12);
	let customWidth = $state(6);
	let customHeight = $state(6.5);

	function selectPreset(preset: TrailerPreset) {
		trailer.select(preset);
		showCustomTrailer = false;
		trailerDropdownOpen = false;
	}

	function applyCustomTrailer() {
		trailer.setCustom(customLength, customWidth, customHeight);
		showCustomTrailer = false;
		trailerDropdownOpen = false;
	}

	// Mobile bottom-sheet state — auto-opens when an item is selected
	let sheetState = $state<'peek' | 'full'>('peek');
	// peekHeight = pill(20) + packer-header(~60px) ≈ 80px
	const SHEET_PEEK_H = 80;

	$effect(() => {
		if (selectedItemId) sheetState = 'full';
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
		if (selectedItemId === id) selectedItemId = null;
		repack();
	}

	function handleItemClick(id: string) {
		const isPacked = liveResult?.placed.some(p => p.item.id === id);
		if (isPacked) {
			selectedItemId = selectedItemId === id ? null : id;
		} else {
			addItem(id);
		}
	}

	const liveResult = $derived.by(() => {
		if (!result) return null;
		const itemMap = new Map(items.map(i => [i.id, i]));
		return {
			...result,
			placed: result.placed
				.filter(p => itemMap.has(p.item.id))
				.map(p => ({
					...p,
					item: itemMap.get(p.item.id)!
				})),
			unplaced: result.unplaced
				.map(u => itemMap.get(u.id) ?? u)
				.filter(Boolean)
		} as PackResult;
	});

	const selectedPacked = $derived(
		liveResult?.placed.find(p => p.item.id === selectedItemId) ?? null
	);

	function shapeLabel(shape: string | undefined): string {
		return SHAPE_OPTIONS.find(s => s.value === shape)?.label ?? 'Box';
	}

	function shapeIcon(shape: string | undefined): string {
		return SHAPE_OPTIONS.find(s => s.value === shape)?.icon ?? '📦';
	}

	type SnapDir = 'left' | 'right' | 'front' | 'behind' | 'above';

	function snapItem(targetId: string, direction: SnapDir) {
		if (!result || !selectedItemId) return;
		const src = result.placed.find(p => p.item.id === selectedItemId);
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

		newPos.x = Math.max(0, newPos.x);
		newPos.y = Math.max(0, newPos.y);
		newPos.z = Math.max(0, newPos.z);

		const updated: PackResult = {
			...result,
			placed: result.placed.map(p =>
				p.item.id === selectedItemId ? { ...p, position: newPos } : p
			)
		};
		packResult.set(updated);
	}

	const otherPacked = $derived(
		liveResult?.placed.filter(p => p.item.id !== selectedItemId) ?? []
	);

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

	const NUDGE_SMALL = 1;   // inches
	const NUDGE_LARGE = 6;

	function nudgeItem(axis: 'x' | 'y' | 'z', delta: number) {
		if (!result || !selectedItemId) return;
		const src = result.placed.find(p => p.item.id === selectedItemId);
		if (!src) return;

		const maxX = currentTrailer.length * 12 - src.rotation.l;
		const maxY = currentTrailer.height * 12 - src.rotation.h;
		const maxZ = currentTrailer.width * 12 - src.rotation.w;

		const newPos = { ...src.position };
		newPos[axis] = Math.max(0, Math.min(
			axis === 'x' ? maxX : axis === 'y' ? maxY : maxZ,
			newPos[axis] + delta
		));

		const updated: PackResult = {
			...result,
			placed: result.placed.map(p =>
				p.item.id === selectedItemId ? { ...p, position: newPos } : p
			)
		};
		packResult.set(updated);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!selectedItemId) return;
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
				selectedItemId = null;
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
		<div class="packer-header">
			<h1>Pack Planner</h1>
		</div>

		<div class="packer-tabs">
			<button class="packer-tab" class:active={activeTab === 'inventory'} onclick={() => activeTab = 'inventory'}>
				Inventory
			</button>
			<button class="packer-tab" class:active={activeTab === 'stats'} onclick={() => activeTab = 'stats'}>
				Stats
			</button>
		</div>

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

			{#if selectedPacked}
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
							onclick={() => selectedItemId = null}
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
								{#each item.contents as content}
									<li>{content}</li>
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

			{#if items.length > 0}
				<details class="accordion" open={accordionState.isOpen('pack-inventory')} ontoggle={(e) => accordionState.toggle('pack-inventory', e.currentTarget.open)}>
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
									class:selected={selectedItemId === item.id}
									role="button"
									tabindex="0"
									onclick={() => handleItemClick(item.id)}
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
			<TrailerScene
				trailer={currentTrailer}
				packedItems={liveResult?.placed ?? []}
				loadStep={0}
				{selectedItemId}
				onSelectItem={(id) => selectedItemId = id}
			/>
		</div>

		<!-- Mobile detail drawer -->
		{#if selectedPacked}
			{@const item = selectedPacked.item}
			<div class="mobile-detail">
				<div class="detail-card">
					<div class="detail-card-header">
						<div class="detail-color-dot" style:background={selectedPacked.color}></div>
						<h3 class="detail-card-name">{item.name}</h3>
						<button class="detail-close" onclick={() => selectedItemId = null} aria-label="Close detail">
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
								{#each item.contents as content}
									<li>{content}</li>
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

		<!-- Floating snap controls — bottom-right of scene -->
		{#if selectedPacked && otherPacked.length > 0}
			<div class="snap-float">
				<span class="snap-float-label">Move <strong>{selectedPacked.item.name}</strong> next to</span>
				<div class="snap-targets">
					{#each otherPacked as target (target.item.id)}
						<div class="snap-target">
							<span class="snap-target-name" style:border-left="3px solid {target.color}">
								{target.item.name}
							</span>
							<div class="snap-btns">
								<button class="snap-btn" onclick={() => snapItem(target.item.id, 'left')} title="Left of">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
								</button>
								<button class="snap-btn" onclick={() => snapItem(target.item.id, 'right')} title="Right of">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
								</button>
								<button class="snap-btn" onclick={() => snapItem(target.item.id, 'behind')} title="Behind">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
								</button>
								<button class="snap-btn" onclick={() => snapItem(target.item.id, 'front')} title="In front">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
								</button>
								<button class="snap-btn snap-above" onclick={() => snapItem(target.item.id, 'above')} title="On top">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
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
		background: #0a0a0a;
	}

	.toggle-panel {
		display: none; /* hidden on mobile — controls are always in the sheet */
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: var(--color-bg-card);
		border-top: 1px solid var(--color-divider);
	}

	.controls-panel {
		background: var(--color-bg);
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

	/* Floating snap panel */
	.snap-float {
		position: absolute;
		bottom: 12px;
		right: 12px;
		max-width: 340px;
		max-height: 50%;
		overflow-y: auto;
		padding: 12px 14px;
		background: rgba(28, 28, 33, 0.92);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow:
			0 0 0 1px var(--color-border-subtle),
			0 16px 48px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.snap-float-label {
		font-size: 11px;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.snap-float-label strong {
		color: var(--color-text);
	}

	.snap-targets {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.snap-target {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 8px;
		background: rgba(255, 255, 255, 0.04);
		border-radius: var(--radius-sm);
	}

	.snap-target-name {
		flex: 1;
		font-size: 12px;
		font-weight: 500;
		padding-left: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.snap-btns {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}

	.snap-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		color: var(--color-text-muted);
		transition: all 0.15s;
	}

	.snap-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text);
	}

	.snap-btn:active {
		background: var(--color-accent-soft);
		color: var(--color-accent);
	}

	.snap-btn.snap-above {
		color: var(--color-text-secondary);
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

		.toggle-panel {
			display: none;
		}

		.controls-panel {
			border-top: 1px solid var(--color-divider);
		}
	}
</style>
