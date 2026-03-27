<script lang="ts">
	import type { PackedItem, TrailerPreset, PackResult, InventoryItem } from '$lib/types';
	import { trailer, packResult, loadOrderStep } from '$lib/stores/trailer';
	import { inventory } from '$lib/stores/inventory';
	import { packItems } from '$lib/utils/packing';
	import { SHAPE_OPTIONS } from '$lib/utils/shapes';
	import { accordionState } from '$lib/stores/app';
	import PackControls from '$lib/components/PackControls.svelte';
	import TrailerScene from '$lib/components/TrailerScene.svelte';

	let currentTrailer = $state<TrailerPreset>({ name: '', length: 12, width: 6, height: 6.5 });
	let result = $state<PackResult | null>(null);
	let step = $state(0);
	let selectedItemId = $state<string | null>(null);
	let showControls = $state(true);
	let items = $state<InventoryItem[]>([]);
	let packedIds = $state(new Set<string>());

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
	loadOrderStep.subscribe((v) => step = v);
	inventory.subscribe((v) => items = v);

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
</script>

<svelte:head>
	<title>Mover — Pack Planner</title>
</svelte:head>

<div class="packer-page">
	<!-- Left sidebar (desktop) / top section (mobile) -->
	<div class="left-panel">
		<div class="packer-header">
			<h1>Pack Planner</h1>
		</div>

		<div class="panel-scroll">
			<div class="controls-panel">
				<PackControls />
			</div>

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
							{@const inTrailer = packedIds.has(item.id)}
								<div
									class="item-row"
									class:packed={!!packed}
									class:unplaced={!!unplaced}
									class:selected={selectedItemId === item.id}
									role="button"
									tabindex="0"
									onclick={() => handleItemClick(item.id)}
									onkeydown={(e) => { if (e.key === 'Enter') handleItemClick(item.id); }}
								>
									<span
										class="item-dot"
										style:background={packed?.color ?? (unplaced ? 'var(--color-warning)' : 'var(--color-border)')}
									></span>
									<span class="item-name">{item.name}</span>
									<span class="item-dims">
										{item.dimensions.l}×{item.dimensions.w}×{item.dimensions.h}″
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
		</div>
	</div>

	<!-- Right: 3D scene -->
	<div class="right-panel">
		<!-- Mobile-only toggle -->
		<button class="toggle-panel" onclick={() => showControls = !showControls}>
			<svg
				width="16" height="16" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round"
				style="transform: rotate({showControls ? '180deg' : '0deg'}); transition: transform 0.2s"
			>
				<polyline points="6 9 12 15 18 9"/>
			</svg>
			{showControls ? 'Hide Controls' : 'Show Controls'}
		</button>

		<div class="scene-area">
			<TrailerScene
				trailer={currentTrailer}
				packedItems={liveResult?.placed ?? []}
				loadStep={step}
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

	.panel-scroll {
		display: none;
	}

	.packer-header {
		padding: 16px;
		flex-shrink: 0;
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
		background: #050505;
	}

	.toggle-panel {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: var(--color-bg-card);
		border-top: 1px solid var(--color-border);
	}

	.controls-panel {
		background: var(--color-bg);
	}

	/* Selected item detail card */
	.detail-card {
		padding: 16px;
		border-top: 1px solid var(--color-border);
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
		padding: 10px 12px;
		background: rgba(23, 23, 23, 0.85);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
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
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		margin: 0 16px;
		overflow: hidden;
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
		padding: 4px 10px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		transition: all 0.15s;
	}

	.add-all-btn:active {
		background: var(--color-bg-elevated);
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
		border-top: 1px solid var(--color-border);
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
			width: 360px;
			flex-shrink: 0;
			border-right: 1px solid var(--color-border);
			background: var(--color-bg);
			overflow: hidden;
		}

		.panel-scroll {
			display: flex;
			flex-direction: column;
			flex: 1;
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
			border-top: 1px solid var(--color-border);
		}
	}
</style>
