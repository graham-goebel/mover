<script lang="ts">
	import type { InventoryItem, ItemCategory, Dimensions } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { volumeCuFt } from '$lib/utils/measurement';
	import ItemCard from './ItemCard.svelte';
	import ItemDetail from './ItemDetail.svelte';
	import CameraCapture from './CameraCapture.svelte';
	import MeasurementCanvas from './MeasurementCanvas.svelte';
	import ItemForm from './ItemForm.svelte';

	let items = $state<InventoryItem[]>([]);
	let editingId = $state<string | null>(null);
	let filterCategory = $state<ItemCategory | 'all'>('all');

	let showAddFlow = $state(false);
	type FlowStep = 'capture' | 'measure' | 'form';
	let flowStep = $state<FlowStep>('capture');
	let photoUrl = $state<string | null>(null);
	let measuredDims = $state<Dimensions | null>(null);
	let finalPhoto = $state<string | null>(null);

	inventory.subscribe((v) => items = v);

	const filters: { value: ItemCategory | 'all'; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'box', label: '📦 Boxes' },
		{ value: 'furniture', label: '🪑 Furniture' },
		{ value: 'appliance', label: '🔌 Appliances' },
		{ value: 'fragile', label: '⚠️ Fragile' },
		{ value: 'oddShape', label: '🔷 Odd' },
		{ value: 'other', label: '📋 Other' }
	];

	const filtered = $derived(
		filterCategory === 'all'
			? items
			: items.filter((it) => it.category === filterCategory)
	);

	const totalVolume = $derived(
		items.reduce((sum, it) => sum + volumeCuFt(it.dimensions.l, it.dimensions.w, it.dimensions.h), 0)
	);

	const editingItem = $derived(items.find((it) => it.id === editingId) ?? null);

	function openAddFlow() {
		showAddFlow = true;
		flowStep = 'capture';
		photoUrl = null;
		measuredDims = null;
		finalPhoto = null;
	}

	function closeAddFlow() {
		showAddFlow = false;
		photoUrl = null;
		measuredDims = null;
		finalPhoto = null;
		flowStep = 'capture';
	}

	function handleCapture(dataUrl: string) {
		photoUrl = dataUrl;
		flowStep = 'measure';
	}

	function handleMeasureComplete(dims: Dimensions, photo: string) {
		measuredDims = dims;
		finalPhoto = photo;
		flowStep = 'form';
	}

	function handleManualEntry() {
		const placeholder = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%231e293b" width="200" height="200"/><text x="50%" y="50%" fill="%2364748b" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="40">📦</text></svg>');
		measuredDims = { l: 0, w: 0, h: 0 };
		finalPhoto = placeholder;
		flowStep = 'form';
	}
</script>

{#if editingItem}
	<ItemDetail item={editingItem} onClose={() => editingId = null} />
{/if}

<div class="inv-page" class:panel-open={showAddFlow}>
	<!-- Left: inventory list -->
	<div class="left-panel">
		<div class="inv-scroll">
			<header class="inv-header">
				<div class="header-top">
					<h1>My Items</h1>
					<div class="stats">
						<span class="stat">{items.length} items</span>
						<span class="stat-dot">·</span>
						<span class="stat">{Math.round(totalVolume * 10) / 10} cu ft</span>
					</div>
				</div>

				<div class="filter-row">
					{#each filters as f}
						<button
							class="filter-pill"
							class:active={filterCategory === f.value}
							onclick={() => filterCategory = f.value}
						>
							{f.label}
						</button>
					{/each}
				</div>
			</header>

			{#if filtered.length === 0}
				<div class="empty-state">
					{#if items.length === 0}
						<div class="empty-icon">📦</div>
						<h3>No items yet</h3>
						<p>Tap the <strong>+</strong> button to photograph and measure your first item</p>
					{:else}
						<p>No items in this category</p>
					{/if}
				</div>
			{:else}
				<div class="item-list">
					{#each filtered as item (item.id)}
						<ItemCard
							{item}
							onTap={(id) => editingId = id}
							onDelete={(id) => inventory.remove(id)}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<button class="fab" onclick={openAddFlow} aria-label="Add item">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
			</svg>
		</button>
	</div>

	<!-- Right: add-item flow -->
	{#if showAddFlow}
		<div class="right-panel">
			<div class="add-header">
				<h2>Add Item</h2>
				<button class="add-close" onclick={closeAddFlow} aria-label="Close">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>

			<div class="add-body">
				{#if flowStep === 'capture'}
					<div class="capture-area">
						<CameraCapture onCapture={handleCapture} />
						<div class="or-divider"><span>or</span></div>
						<button class="manual-btn" onclick={handleManualEntry}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
							Add Manually
						</button>
					</div>
				{:else if flowStep === 'measure' && photoUrl}
					<MeasurementCanvas
						{photoUrl}
						onComplete={handleMeasureComplete}
						onCancel={() => { photoUrl = null; flowStep = 'capture'; }}
					/>
				{:else if flowStep === 'form' && measuredDims && finalPhoto}
					<ItemForm
						photo={finalPhoto}
						dimensions={measuredDims}
						onBack={() => { flowStep = 'measure'; }}
						onSaved={closeAddFlow}
					/>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.inv-page {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	/* Left panel — full width on mobile */
	.left-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		position: relative;
	}

	.inv-scroll {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 0 16px 24px;
	}

	/* Right panel — overlay on mobile */
	.right-panel {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: var(--color-bg);
		display: flex;
		flex-direction: column;
	}

	.add-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.add-header h2 {
		font-size: 17px;
		font-weight: 600;
	}

	.add-close {
		padding: 6px;
		color: var(--color-text-secondary);
		border-radius: 6px;
		transition: background 0.15s;
	}

	.add-close:hover {
		background: var(--color-bg-elevated);
	}

	.add-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.capture-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0;
		padding: 24px;
	}

	.or-divider {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 200px;
		color: var(--color-text-muted);
		font-size: 13px;
	}

	.or-divider::before,
	.or-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.manual-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 24px;
		font-size: 15px;
		font-weight: 600;
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		transition: all 0.15s;
	}

	.manual-btn:active {
		background: var(--color-bg-elevated);
	}

	/* Header */
	.inv-header {
		position: sticky;
		top: 0;
		background: var(--color-bg);
		z-index: 10;
		padding: 16px 0 12px;
	}

	.header-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 14px;
	}

	h1 {
		font-size: 28px;
		font-weight: 700;
	}

	.stats {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.stat {
		font-size: 14px;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.stat-dot {
		color: var(--color-text-muted);
	}

	.filter-row {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding-bottom: 4px;
	}

	.filter-row::-webkit-scrollbar {
		display: none;
	}

	.filter-pill {
		white-space: nowrap;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 100px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-secondary);
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.filter-pill.active {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-fg);
	}

	.item-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 4px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 60px 24px;
		text-align: center;
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 8px;
	}

	.empty-state h3 {
		font-size: 18px;
		font-weight: 600;
	}

	.empty-state p {
		font-size: 14px;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	/* FAB */
	.fab {
		position: fixed;
		bottom: calc(var(--tab-bar-height) + 8px);
		right: 20px;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		z-index: 40;
		transition: transform 0.15s, box-shadow 0.15s;
		-webkit-tap-highlight-color: transparent;
	}

	.fab:active {
		transform: scale(0.92);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	/* ---- Desktop: side-by-side ---- */
	@media (min-width: 768px) {
		.inv-page {
			flex-direction: row;
		}

		.left-panel {
			width: 400px;
			flex-shrink: 0;
			border-right: 1px solid var(--color-border);
			background: var(--color-bg);
		}

		.inv-page.panel-open .left-panel {
			width: 360px;
		}

		.right-panel {
			position: relative;
			inset: unset;
			z-index: auto;
			flex: 1;
			min-width: 0;
		}

		.fab {
			position: absolute;
			bottom: 20px;
			right: 20px;
		}
	}
</style>
