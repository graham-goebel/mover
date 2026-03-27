<script lang="ts">
	import type { TrailerPreset, PackResult } from '$lib/types';
	import { TRAILER_PRESETS, trailer, packResult, loadOrderStep } from '$lib/stores/trailer';
	import { inventory } from '$lib/stores/inventory';
	import { packItems } from '$lib/utils/packing';

	let items = $state<import('$lib/types').InventoryItem[]>([]);
	let currentTrailer = $state<TrailerPreset>(TRAILER_PRESETS[2]);
	let result = $state<PackResult | null>(null);
	let step = $state(0);
	let customLength = $state(12);
	let customWidth = $state(6);
	let customHeight = $state(6.5);
	let showCustom = $state(false);
	let selectedItemId = $state<string | null>(null);

	inventory.subscribe((v) => items = v);
	trailer.subscribe((v) => currentTrailer = v);
	packResult.subscribe((v) => result = v);
	loadOrderStep.subscribe((v) => step = v);

	function selectPreset(preset: TrailerPreset) {
		trailer.select(preset);
		showCustom = false;
	}

	function applyCustom() {
		trailer.setCustom(customLength, customWidth, customHeight);
		showCustom = false;
	}

	function runPacking() {
		if (items.length === 0) return;
		const res = packItems(items, currentTrailer);
		packResult.set(res);
		loadOrderStep.set(0);
		selectedItemId = null;
	}

	function nextStep() {
		if (!result) return;
		if (step < result.placed.length) {
			loadOrderStep.set(step + 1);
		}
	}

	function prevStep() {
		if (step > 0) {
			loadOrderStep.set(step - 1);
		}
	}

	function resetSteps() {
		loadOrderStep.set(0);
		selectedItemId = null;
	}

	const selectedPacked = $derived(
		result?.placed.find((p) => p.item.id === selectedItemId) ?? null
	);

	export function getSelectedId() { return selectedItemId; }
	export function setSelectedId(id: string | null) { selectedItemId = id; }
	export function getTrailer() { return currentTrailer; }
	export function getResult() { return result; }
	export function getStep() { return step; }
</script>

<div class="controls">
	<div class="section">
		<h3 class="section-label">Trailer</h3>
		<div class="preset-grid">
			{#each TRAILER_PRESETS as preset}
				<button
					class="preset-btn"
					class:active={currentTrailer.name === preset.name}
					onclick={() => selectPreset(preset)}
				>
					<span class="preset-name">{preset.name}</span>
					<span class="preset-dims">{preset.length}' × {preset.width}' × {preset.height}'</span>
				</button>
			{/each}
			<button
				class="preset-btn"
				class:active={currentTrailer.name === 'Custom'}
				onclick={() => showCustom = !showCustom}
			>
				<span class="preset-name">Custom</span>
				<span class="preset-dims">Set your own</span>
			</button>
		</div>

		{#if showCustom}
			<div class="custom-row">
				<label class="custom-field">
					<span>L (ft)</span>
					<input type="number" bind:value={customLength} min="1" step="0.5" inputmode="decimal" />
				</label>
				<label class="custom-field">
					<span>W (ft)</span>
					<input type="number" bind:value={customWidth} min="1" step="0.5" inputmode="decimal" />
				</label>
				<label class="custom-field">
					<span>H (ft)</span>
					<input type="number" bind:value={customHeight} min="1" step="0.5" inputmode="decimal" />
				</label>
				<button class="apply-btn" onclick={applyCustom}>Set</button>
			</div>
		{/if}
	</div>

	<button
		class="pack-btn"
		onclick={runPacking}
		disabled={items.length === 0}
	>
		{#if items.length === 0}
			No items to pack
		{:else}
			Pack {items.length} items into {currentTrailer.name}
		{/if}
	</button>

	{#if result}
		<div class="result-summary">
			<div class="stat-row">
				<div class="result-stat">
					<span class="result-val">{result.placed.length}</span>
					<span class="result-label">Placed</span>
				</div>
				<div class="result-stat">
					<span class="result-val warn">{result.unplaced.length}</span>
					<span class="result-label">Won't fit</span>
				</div>
				<div class="result-stat">
					<span class="result-val accent">{result.utilization}%</span>
					<span class="result-label">Used</span>
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

			<div class="load-order">
				<h3 class="section-label">Load Order</h3>
				<div class="stepper">
					<button class="step-btn" onclick={prevStep} disabled={step <= 0} aria-label="Previous step">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
					</button>
					<span class="step-display">
						{#if step === 0}
							All ({result.placed.length})
						{:else}
							{step} / {result.placed.length}
						{/if}
					</span>
					<button class="step-btn" onclick={nextStep} disabled={step >= result.placed.length} aria-label="Next step">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
				{#if step > 0}
					{@const current = result.placed[step - 1]}
					<div class="current-item" style="border-left: 4px solid {current.color};">
						<span class="current-name">{current.item.name}</span>
						<span class="current-dims">{current.rotation.l}″ × {current.rotation.w}″ × {current.rotation.h}″</span>
					</div>
				{/if}
				{#if step > 0}
					<button class="reset-btn" onclick={resetSteps}>Show All</button>
				{/if}
			</div>
		</div>

		{#if selectedPacked}
			<div class="selected-info" style="border-left: 4px solid {selectedPacked.color};">
				<span class="sel-name">{selectedPacked.item.name}</span>
				<span class="sel-dims">{selectedPacked.rotation.l}″ × {selectedPacked.rotation.w}″ × {selectedPacked.rotation.h}″</span>
				{#if selectedPacked.item.fragile}
					<span class="sel-badge">⚠️ Fragile</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.controls {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.section-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 8px;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.preset-btn {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		text-align: left;
		transition: all 0.15s;
	}

	.preset-btn.active {
		border-color: #525252;
		background: var(--color-bg-elevated);
	}

	.preset-name {
		font-size: 13px;
		font-weight: 600;
	}

	.preset-dims {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.custom-row {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		margin-top: 8px;
	}

	.custom-field {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.custom-field span {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.custom-field input {
		text-align: center;
		padding: 8px 4px;
		font-size: 14px;
	}

	.apply-btn {
		padding: 8px 14px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 13px;
		font-weight: 600;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.pack-btn {
		width: 100%;
		padding: 14px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 15px;
		font-weight: 600;
		border-radius: var(--radius-md);
		transition: background 0.15s;
	}

	.pack-btn:disabled {
		opacity: 0.4;
	}

	.pack-btn:active {
		background: var(--color-accent-hover);
	}

	.result-summary {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.stat-row {
		display: flex;
		gap: 12px;
	}

	.result-stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 12px 8px;
		background: var(--color-bg-card);
		border-radius: var(--radius-sm);
	}

	.result-val {
		font-size: 22px;
		font-weight: 700;
	}

	.result-val.warn {
		color: var(--color-warning);
	}

	.result-val.accent {
		color: var(--color-accent);
	}

	.result-label {
		font-size: 11px;
		color: var(--color-text-muted);
		font-weight: 500;
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

	.load-order {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}

	.step-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		transition: all 0.15s;
	}

	.step-btn:disabled {
		opacity: 0.3;
	}

	.step-display {
		font-size: 16px;
		font-weight: 600;
		min-width: 80px;
		text-align: center;
	}

	.current-item {
		padding: 10px 14px;
		background: var(--color-bg-card);
		border-radius: var(--radius-sm);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.current-name {
		font-size: 14px;
		font-weight: 600;
	}

	.current-dims {
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.reset-btn {
		font-size: 13px;
		color: var(--color-accent);
		font-weight: 600;
		text-align: center;
		padding: 6px;
	}

	.selected-info {
		padding: 12px 14px;
		background: var(--color-bg-card);
		border-radius: var(--radius-sm);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.sel-name { font-weight: 600; font-size: 15px; }
	.sel-dims { font-size: 13px; color: var(--color-text-secondary); }
	.sel-badge { font-size: 12px; }
</style>
