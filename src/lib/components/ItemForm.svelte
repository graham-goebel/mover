<script lang="ts">
	import type { Dimensions, ItemCategory, ItemShape } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { SHAPE_OPTIONS, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';
	import type { RoomPresetId } from '$lib/utils/rooms';
	import { roomFromPresetAndCustom } from '$lib/utils/rooms';
	import RoomPicker from './RoomPicker.svelte';
	import ItemFlagsDropdown from './ItemFlagsDropdown.svelte';

	interface Props {
		photo: string;
		dimensions: Dimensions;
		onBack: () => void;
		onSaved?: () => void;
	}

	let { photo, dimensions, onBack, onSaved }: Props = $props();

	let name = $state('');
	let category = $state<ItemCategory>('box');
	let shape = $state<ItemShape>('box');
	let forSale = $state(false);
	let fragile = $state(false);
	let stackable = $state(true);
	let donate = $state(false);
	let important = $state(false);
	let weight = $state(0);
	let notes = $state('');
	let roomPreset = $state<RoomPresetId>('general');
	let roomCustom = $state('');

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

	function handleSave() {
		if (!name.trim()) return;
		inventory.add({
			name: name.trim(),
			photo,
			dimensions,
			weight: weight || undefined,
			category,
			shape,
			fragile,
			stackable,
			forSale,
			donate,
			important,
			room: roomFromPresetAndCustom(roomPreset, roomCustom),
			contents: [],
			notes: notes || undefined
		});
		if (onSaved) {
			onSaved();
		} else {
			goto(`${base}/`);
		}
	}
</script>

<div class="form-view">
	<div class="form-header">
		<button class="back-btn" onclick={onBack} aria-label="Go back">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
		</button>
		<h2>New Item</h2>
		<button class="save-btn" onclick={handleSave} disabled={!name.trim()}>Add</button>
	</div>

	<div class="form-body">
		<div class="field">
			<label for="new-name">Item Name</label>
			<input id="new-name" type="text" bind:value={name} placeholder="e.g. Kitchen box, Couch, TV…" />
		</div>

		<RoomPicker bind:preset={roomPreset} bind:custom={roomCustom} fieldId="new-item-room" />

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
			<label class="field-label" for="form-item-shape">3D Shape</label>
			<select id="form-item-shape" class="shape-select" bind:value={shape}>
				{#each SHAPE_OPTIONS as s}
					<option value={s.value}>{s.icon} {s.label}</option>
				{/each}
			</select>
		</div>

		<div class="photo-dims">
			<div class="mini-photo">
				<img src={photo} alt="Item" />
			</div>
			<div class="dims-display">
				<span class="dim-val">{dimensions.l}″ × {dimensions.w}″ × {dimensions.h}″</span>
			</div>
		</div>

		<div class="field">
			<label for="new-weight">Weight (lbs, optional)</label>
			<input id="new-weight" type="number" bind:value={weight} min="0" step="1" inputmode="numeric" placeholder="0" />
		</div>

		<ItemFlagsDropdown
			bind:forSale
			bind:fragile
			bind:stackable
			bind:donate
			bind:important
			fieldId="form-item-flags"
		/>

		<div class="field">
			<label for="new-notes">Notes (optional)</label>
			<textarea id="new-notes" bind:value={notes} rows="2" placeholder="Keep upright, load last…"></textarea>
		</div>

		<button class="submit-btn" onclick={handleSave} disabled={!name.trim()}>
			Add to Inventory
		</button>
	</div>
</div>

<style>
	.form-view {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.form-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-divider);
	}

	.form-header h2 {
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

	.save-btn:disabled {
		opacity: 0.4;
	}

	.form-body {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding-bottom: calc(100px + var(--safe-area-bottom));
	}

	.photo-dims {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		background: var(--color-bg-card);
		border-radius: var(--radius-md);
	}

	.mini-photo {
		width: 64px;
		height: 64px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		flex-shrink: 0;
	}

	.mini-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.dim-val {
		font-size: 16px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
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

	.cat-icon { font-size: 20px; }
	.cat-label { font-size: 12px; font-weight: 500; }

	.shape-select {
		width: 100%;
		cursor: pointer;
		color-scheme: dark;
	}

	textarea {
		resize: vertical;
		min-height: 60px;
	}

	.submit-btn {
		width: 100%;
		padding: 16px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 16px;
		font-weight: 600;
		border-radius: var(--radius-md);
		transition: background 0.15s;
	}

	.submit-btn:disabled { opacity: 0.4; }
	.submit-btn:active { background: var(--color-accent-hover); }
</style>
