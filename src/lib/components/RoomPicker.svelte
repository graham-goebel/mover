<script lang="ts">
	import type { RoomPresetId } from '$lib/utils/rooms';
	import { ROOM_CHIP_ORDER, roomChipLabel } from '$lib/utils/rooms';

	interface Props {
		preset: RoomPresetId;
		custom: string;
		fieldId?: string;
	}

	let { preset = $bindable(), custom = $bindable(), fieldId = 'item-room' }: Props = $props();

	function selectChip(id: RoomPresetId) {
		preset = id;
		if (id !== 'custom') custom = '';
	}
</script>

<div class="field room-field">
	<span class="field-label" id="{fieldId}-label">Room / location</span>
	<p class="room-hint">General = not tied to a specific room</p>
	<div class="room-chip-grid" role="group" aria-labelledby="{fieldId}-label">
		{#each ROOM_CHIP_ORDER as id}
			<button
				type="button"
				class="room-chip"
				class:active={preset === id}
				onclick={() => selectChip(id)}
			>
				{roomChipLabel(id)}
			</button>
		{/each}
	</div>
	{#if preset === 'custom'}
		<label class="sr-only" for="{fieldId}-custom">Custom room name</label>
		<input
			id="{fieldId}-custom"
			type="text"
			class="room-custom-input"
			bind:value={custom}
			placeholder="e.g. Attic, Shed, Guest room…"
			autocomplete="off"
		/>
	{/if}
</div>

<style>
	.room-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.room-hint {
		font-size: 12px;
		color: var(--color-text-muted);
		margin: -4px 0 0;
		line-height: 1.35;
	}

	.room-chip-grid {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 8px;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
		scrollbar-width: thin;
		scrollbar-color: var(--color-border-subtle) transparent;
		/* Pull scroll area to edges of padded parents without clipping focus rings */
		margin-left: -4px;
		margin-right: -4px;
		padding-left: 4px;
		padding-right: 4px;
		padding-bottom: 4px;
	}

	.room-chip-grid::-webkit-scrollbar {
		height: 5px;
	}

	.room-chip-grid::-webkit-scrollbar-track {
		background: transparent;
	}

	.room-chip-grid::-webkit-scrollbar-thumb {
		background: var(--color-border-subtle);
		border-radius: 100px;
	}

	.room-chip {
		flex-shrink: 0;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 500;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-bg-card);
		color: var(--color-text-secondary);
		transition: background 0.2s ease, color 0.2s ease;
	}

	.room-chip.active {
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}

	.room-custom-input {
		width: 100%;
		margin-top: 4px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
