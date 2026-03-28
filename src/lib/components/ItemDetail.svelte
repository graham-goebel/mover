<script lang="ts">
	import type { InventoryItem, ItemCategory, ItemShape } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { volumeCuFt } from '$lib/utils/measurement';
	import { untrack } from 'svelte';
	import { SHAPE_OPTIONS, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';
	import ContentsEditor from './ContentsEditor.svelte';
	import type { RoomPresetId } from '$lib/utils/rooms';
	import { roomFromPresetAndCustom, splitStoredRoom } from '$lib/utils/rooms';
	import RoomPicker from './RoomPicker.svelte';
	import ItemFlagsDropdown from './ItemFlagsDropdown.svelte';

	interface Props {
		item: InventoryItem;
		onClose: () => void;
	}

	let { item, onClose }: Props = $props();

	function initFrom(it: InventoryItem) {
		const r = splitStoredRoom(it.room);
		return {
			name: it.name,
			l: it.dimensions.l,
			w: it.dimensions.w,
			h: it.dimensions.h,
			weight: it.weight ?? 0,
			category: it.category as ItemCategory,
			shape: (it.shape ?? CATEGORY_DEFAULT_SHAPE[it.category] ?? 'generic') as ItemShape,
			forSale: it.forSale ?? false,
			fragile: it.fragile,
			stackable: it.stackable,
			donate: it.donate ?? false,
			notes: it.notes ?? '',
			roomPreset: r.preset,
			roomCustom: r.custom
		};
	}

	const init = untrack(() => initFrom(item));
	let name = $state(init.name);
	let l = $state(init.l);
	let w = $state(init.w);
	let h = $state(init.h);
	let weight = $state(init.weight);
	let category = $state<ItemCategory>(init.category);
	let shape = $state<ItemShape>(init.shape);
	let forSale = $state(init.forSale);
	let fragile = $state(init.fragile);
	let stackable = $state(init.stackable);
	let donate = $state(init.donate);
	let notes = $state(init.notes);
	let roomPreset = $state<RoomPresetId>(init.roomPreset);
	let roomCustom = $state(init.roomCustom);
	let showDeleteConfirm = $state(false);

	const categories: { value: ItemCategory; label: string; icon: string }[] = [
		{ value: 'box', label: 'Box', icon: '📦' },
		{ value: 'furniture', label: 'Furniture', icon: '🪑' },
		{ value: 'appliance', label: 'Appliance', icon: '🔌' },
		{ value: 'fragile', label: 'Fragile', icon: '⚠️' },
		{ value: 'oddShape', label: 'Odd Shape', icon: '🔷' },
		{ value: 'other', label: 'Other', icon: '📋' }
	];

	function setCategory(cat: ItemCategory) {
		category = cat;
		shape = CATEGORY_DEFAULT_SHAPE[cat] ?? 'generic';
	}

	function save() {
		inventory.update(item.id, {
			name,
			dimensions: { l, w, h },
			weight: weight || undefined,
			category,
			shape,
			forSale,
			fragile,
			stackable,
			donate,
			room: roomFromPresetAndCustom(roomPreset, roomCustom),
			notes: notes || undefined
		});
		onClose();
	}

	function handleDelete() {
		inventory.remove(item.id);
		onClose();
	}

	const vol = $derived(volumeCuFt(l, w, h));
</script>

<div class="detail-overlay">
	<div class="detail-panel">
		<div class="detail-header">
			<button class="back-btn" onclick={onClose} aria-label="Go back">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
			<h2>Edit Item</h2>
			<button class="save-btn" onclick={save}>Save</button>
		</div>

		<div class="detail-body">
			{#if item.photo}
				<div class="photo-section">
					<img src={item.photo} alt={name} />
				</div>
			{/if}

			<div class="field">
				<label for="item-name">Name</label>
				<input id="item-name" type="text" bind:value={name} />
			</div>

			<RoomPicker bind:preset={roomPreset} bind:custom={roomCustom} fieldId="detail-room" />

			<div class="field">
				<span class="field-label">Category</span>
				<div class="cat-grid">
					{#each categories as cat}
						<button
							class="cat-btn"
							class:active={category === cat.value}
							onclick={() => setCategory(cat.value)}
						>
							<span class="cat-icon">{cat.icon}</span>
							<span class="cat-label">{cat.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="field">
				<span class="field-label">Dimensions</span>
				<div class="dims-row">
					<div class="dim-input">
						<input type="number" bind:value={l} min="0" step="0.1" inputmode="decimal" />
						<span>L</span>
					</div>
					<span class="dim-x">×</span>
					<div class="dim-input">
						<input type="number" bind:value={w} min="0" step="0.1" inputmode="decimal" />
						<span>W</span>
					</div>
					<span class="dim-x">×</span>
					<div class="dim-input">
						<input type="number" bind:value={h} min="0" step="0.1" inputmode="decimal" />
						<span>H</span>
					</div>
				</div>
				<p class="dim-summary">{vol} cu ft</p>
			</div>

			<div class="field">
				<label for="item-weight">Weight (lbs)</label>
				<input id="item-weight" type="number" bind:value={weight} min="0" step="1" inputmode="numeric" />
			</div>

			<div class="field">
				<label class="field-label" for="detail-item-shape">3D Shape</label>
				<select id="detail-item-shape" class="shape-select" bind:value={shape}>
					{#each SHAPE_OPTIONS as s}
						<option value={s.value}>{s.icon} {s.label}</option>
					{/each}
				</select>
			</div>

			<ItemFlagsDropdown
				bind:forSale
				bind:fragile
				bind:stackable
				bind:donate
				fieldId="detail-item-flags"
			/>

			<ContentsEditor itemId={item.id} contents={item.contents} />

			<div class="field">
				<label for="item-notes">Notes</label>
				<textarea id="item-notes" bind:value={notes} rows="3" placeholder="Special instructions…"></textarea>
			</div>

			<div class="danger-zone">
				{#if showDeleteConfirm}
					<p class="delete-confirm-text">Delete this item?</p>
					<div class="delete-confirm-btns">
						<button class="cancel-delete" onclick={() => showDeleteConfirm = false}>Cancel</button>
						<button class="confirm-delete" onclick={handleDelete}>Delete</button>
					</div>
				{:else}
					<button class="delete-btn" onclick={() => showDeleteConfirm = true}>Delete Item</button>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.detail-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: var(--color-bg);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.detail-panel {
		max-width: 480px;
		margin: 0 auto;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-divider);
		position: sticky;
		top: 0;
		background: var(--color-bg);
		z-index: 10;
	}

	.detail-header h2 {
		font-size: 17px;
		font-weight: 600;
	}

	.back-btn {
		padding: 6px;
		color: var(--color-accent);
	}

	.save-btn {
		padding: 6px 14px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 14px;
		font-weight: 600;
		border-radius: var(--radius-sm);
	}

	.detail-body {
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding-bottom: calc(100px + var(--safe-area-bottom));
	}

	.photo-section {
		border-radius: var(--radius-md);
		overflow: hidden;
		max-height: 220px;
	}

	.photo-section img {
		width: 100%;
		object-fit: cover;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field label, .field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.dims-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.dim-input {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.dim-input input {
		width: 100%;
		text-align: center;
		font-size: 18px;
		font-weight: 600;
		padding: 8px;
	}

	.dim-input span {
		font-size: 11px;
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.dim-x {
		font-size: 16px;
		color: var(--color-text-muted);
		margin-top: -16px;
	}

	.dim-summary {
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.cat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.cat-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 8px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-bg-card);
		transition: background 0.2s ease, box-shadow 0.2s ease;
	}

	.cat-btn.active {
		background: var(--color-bg-elevated);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}

	.cat-icon {
		font-size: 20px;
	}

	.cat-label {
		font-size: 12px;
		font-weight: 500;
	}

	.shape-select {
		width: 100%;
		cursor: pointer;
		color-scheme: dark;
	}

	textarea {
		resize: vertical;
		min-height: 60px;
	}

	.danger-zone {
		padding-top: 12px;
		border-top: 1px solid var(--color-divider);
	}

	.delete-btn {
		width: 100%;
		padding: 12px;
		color: var(--color-danger);
		font-size: 15px;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-danger-soft);
		transition: background 0.15s;
	}

	.delete-btn:active {
		background: rgba(239, 68, 68, 0.2);
	}

	.delete-confirm-text {
		text-align: center;
		font-size: 15px;
		font-weight: 500;
		margin-bottom: 12px;
	}

	.delete-confirm-btns {
		display: flex;
		gap: 12px;
	}

	.cancel-delete, .confirm-delete {
		flex: 1;
		padding: 12px;
		font-size: 15px;
		font-weight: 600;
		border-radius: var(--radius-md);
	}

	.cancel-delete {
		border: none;
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
	}

	.confirm-delete {
		background: var(--color-danger);
		color: white;
	}
</style>
