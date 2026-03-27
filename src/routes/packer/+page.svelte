<script lang="ts">
	import type { PackedItem, TrailerPreset, PackResult, InventoryItem } from '$lib/types';
	import { trailer, packResult, loadOrderStep } from '$lib/stores/trailer';
	import { inventory } from '$lib/stores/inventory';
	import PackControls from '$lib/components/PackControls.svelte';
	import TrailerScene from '$lib/components/TrailerScene.svelte';

	let currentTrailer = $state<TrailerPreset>({ name: '', length: 12, width: 6, height: 6.5 });
	let result = $state<PackResult | null>(null);
	let step = $state(0);
	let selectedItemId = $state<string | null>(null);
	let showControls = $state(true);
	let items = $state<InventoryItem[]>([]);

	trailer.subscribe((v) => currentTrailer = v);
	packResult.subscribe((v) => result = v);
	loadOrderStep.subscribe((v) => step = v);
	inventory.subscribe((v) => items = v);
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

			{#if items.length > 0}
				<div class="inventory-summary">
					<h3 class="section-label">Inventory ({items.length})</h3>
					<div class="item-list">
						{#each items as item (item.id)}
							{@const packed = result?.placed.find(p => p.item.id === item.id)}
							{@const unplaced = result?.unplaced.find(u => u.id === item.id)}
							<button
								class="item-row"
								class:packed={!!packed}
								class:unplaced={!!unplaced}
								class:selected={selectedItemId === item.id}
								onclick={() => { if (packed) selectedItemId = selectedItemId === item.id ? null : item.id; }}
							>
								<span
									class="item-dot"
									style:background={packed?.color ?? (unplaced ? 'var(--color-warning)' : 'var(--color-border)')}
								></span>
								<span class="item-name">{item.name}</span>
								<span class="item-dims">
									{item.dimensions.l}×{item.dimensions.w}×{item.dimensions.h}″
								</span>
							</button>
						{/each}
					</div>
				</div>
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
			{#if result && result.placed.length > 0}
				<TrailerScene
					trailer={currentTrailer}
					packedItems={result.placed}
					loadStep={step}
					{selectedItemId}
					onSelectItem={(id) => selectedItemId = id}
				/>
			{:else}
				<div class="scene-placeholder">
					<div class="placeholder-icon">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
							<path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2"/>
						</svg>
					</div>
					<p>Select a trailer and pack your items</p>
				</div>
			{/if}
		</div>
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

	.scene-placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: var(--color-text-muted);
	}

	.placeholder-icon {
		opacity: 0.4;
	}

	.scene-placeholder p {
		font-size: 14px;
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

	/* Inventory sidebar list */
	.inventory-summary {
		padding: 16px;
		border-top: 1px solid var(--color-border);
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

	.item-row.packed {
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

	/* ---- Desktop: side-by-side ---- */
	@media (min-width: 768px) {
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
