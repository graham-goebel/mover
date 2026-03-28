<script lang="ts">
	import type { InventoryItem } from '$lib/types';
	import { volumeCuFt } from '$lib/utils/measurement';
	import { roomDisplayLabel, isGeneralRoom } from '$lib/utils/rooms';

	interface Props {
		item: InventoryItem;
		onTap: (id: string) => void;
		onDelete: (id: string) => void;
	}

	let { item, onTap, onDelete }: Props = $props();

	let touchStartX = $state(0);
	let swipeX = $state(0);
	let swiping = $state(false);

	const categoryIcons: Record<string, string> = {
		box: '📦',
		furniture: '🪑',
		appliance: '🔌',
		fragile: '⚠️',
		oddShape: '🔷',
		other: '📋'
	};

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		swiping = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!swiping) return;
		const dx = e.touches[0].clientX - touchStartX;
		swipeX = Math.min(0, dx);
	}

	function handleTouchEnd() {
		if (swipeX < -100) {
			onDelete(item.id);
		}
		swipeX = 0;
		swiping = false;
	}

	const vol = $derived(volumeCuFt(item.dimensions.l, item.dimensions.w, item.dimensions.h));
</script>

<div
	class="card-wrapper"
	role="listitem"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	<div class="delete-bg">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
	</div>

	<button
		class="card"
		style="transform: translateX({swipeX}px)"
		onclick={() => onTap(item.id)}
	>
		{#if item.photo}
			<div class="thumb">
				<img src={item.photo} alt={item.name} />
			</div>
		{:else}
			<div class="thumb placeholder">
				<span>{categoryIcons[item.category] || '📋'}</span>
			</div>
		{/if}

		<div class="info">
			<div class="name-row">
				<span class="name">{item.name}</span>
				{#if item.forSale}
					<span class="badge sale">For Sale</span>
				{/if}
				{#if item.donate}
					<span class="badge donate">Donate</span>
				{/if}
				{#if item.fragile}
					<span class="badge fragile">Fragile</span>
				{/if}
			</div>
			<div class="dims">
				{item.dimensions.l}″ × {item.dimensions.w}″ × {item.dimensions.h}″
			</div>
			<div class="meta">
				{#if !isGeneralRoom(item.room)}
					<span class="room-tag">{roomDisplayLabel(item.room)}</span>
				{/if}
				<span class="vol">{vol} cu ft</span>
				{#if item.contents.length > 0}
					<span class="contents-count">{item.contents.length} items inside</span>
				{/if}
			</div>
		</div>

		<div class="category-icon">{categoryIcons[item.category] || '📋'}</div>
	</button>
</div>

<style>
	.card-wrapper {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-lg);
	}

	.delete-bg {
		position: absolute;
		inset: 0;
		background: var(--color-danger);
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding-right: 24px;
		border-radius: var(--radius-lg);
	}

	.card {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		padding: 16px 16px;
		min-height: 72px;
		background: var(--color-bg-card);
		border-radius: var(--radius-lg);
		text-align: left;
		position: relative;
		transition: transform 0.15s;
	}

	.card:active {
		background: var(--color-bg-elevated);
	}

	.thumb {
		width: 62px;
		height: 62px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		flex-shrink: 0;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb.placeholder {
		background: var(--color-bg-elevated);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
	}

	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.name-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.name {
		font-size: 15px;
		font-weight: 600;
		letter-spacing: var(--letter-snug);
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 4px;
		white-space: nowrap;
	}

	.badge.fragile {
		background: var(--color-warning-soft);
		color: var(--color-warning);
	}

	.badge.sale {
		background: rgba(255, 255, 255, 0.08);
		color: #d4d4d4;
	}

	.badge.donate {
		background: rgba(255, 255, 255, 0.06);
		color: #a3a3a3;
	}

	.dims {
		font-size: 13px;
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
		line-height: 1.4;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		font-size: 12px;
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	.room-tag {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: var(--color-bg-elevated);
		padding: 2px 8px;
		border-radius: 100px;
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.category-icon {
		font-size: 20px;
		flex-shrink: 0;
	}
</style>
