<script lang="ts">
	import type { InventoryItem, ItemCategory } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { volumeCuFt } from '$lib/utils/measurement';
	import ItemCard from './ItemCard.svelte';
	import ItemDetail from './ItemDetail.svelte';

	let items = $state<InventoryItem[]>([]);
	let editingId = $state<string | null>(null);
	let filterCategory = $state<ItemCategory | 'all'>('all');

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
</script>

{#if editingItem}
	<ItemDetail item={editingItem} onClose={() => editingId = null} />
{/if}

<div class="inventory">
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
				<p>Tap <strong>Add Item</strong> to photograph and measure your first item</p>
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

<style>
	.inventory {
		padding: 0 16px 24px;
	}

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
</style>
