<script lang="ts">
	import type { TrailerPreset, PackResult } from '$lib/types';
	import { TRAILER_PRESETS, trailer, packResult, loadOrderStep } from '$lib/stores/trailer';
	import { inventory } from '$lib/stores/inventory';
	import { accordionState } from '$lib/stores/app';


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

	const CU_IN_PER_CU_FT = 1728;

	/** Trailer interior volume (cu ft) */
	const containerCuFt = $derived(
		currentTrailer.length * currentTrailer.width * currentTrailer.height
	);

	/** Volume occupied by placed items (cu ft) */
	const usedCuFt = $derived.by(() => {
		if (!result) return 0;
		return (
			result.placed.reduce(
				(s, p) => s + (p.rotation.l * p.rotation.w * p.rotation.h) / CU_IN_PER_CU_FT,
				0
			)
		);
	});

	const spaceLeftCuFt = $derived(Math.max(0, containerCuFt - usedCuFt));

	const volBarPct = $derived(
		result ? Math.min(100, Math.max(0, result.utilization)) : 0
	);

	const payloadLbs = $derived(Math.max(1, currentTrailer.payloadLbs ?? 2500));

	const placedWeightLbs = $derived.by(() => {
		if (!result) return 0;
		return result.placed.reduce((s, p) => s + (p.item.weight ?? 0), 0);
	});

	const weightUtilPct = $derived(
		payloadLbs > 0 ? (placedWeightLbs / payloadLbs) * 100 : 0
	);

	const weightBarPct = $derived(Math.min(100, Math.max(0, weightUtilPct)));

	const weightLeftLbs = $derived(payloadLbs - placedWeightLbs);

	const placedWithoutWeight = $derived.by(() => {
		if (!result) return 0;
		return result.placed.filter((p) => p.item.weight == null || p.item.weight <= 0).length;
	});

	function fmtCuFt(n: number): string {
		if (n >= 100) return `${Math.round(n)}`;
		if (n >= 10) return `${Math.round(n * 10) / 10}`;
		return `${Math.round(n * 10) / 10}`;
	}

	export function getSelectedId() { return selectedItemId; }
	export function setSelectedId(id: string | null) { selectedItemId = id; }
	export function getTrailer() { return currentTrailer; }
	export function getResult() { return result; }
	export function getStep() { return step; }
</script>

<div class="controls">
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
				<div
					class="cap-bar-track"
					role="progressbar"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={Math.round(Math.min(100, result.utilization))}
					aria-label="Trailer space used"
				>
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
				<div
					class="cap-bar-track"
					class:over-cap={weightUtilPct > 100}
					role="progressbar"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={Math.round(Math.min(100, weightUtilPct))}
					aria-label="Trailer weight versus payload limit"
				>
					<div class="cap-bar-fill weight" style:width="{weightBarPct}%"></div>
				</div>
				{#if placedWithoutWeight > 0}
					<p class="cap-bar-hint">
						{placedWithoutWeight} item{placedWithoutWeight === 1 ? '' : 's'} missing weight — bar may be low
					</p>
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
	{/if}

	<details class="accordion" open={accordionState.isOpen('pack-trailer')} ontoggle={(e) => accordionState.toggle('pack-trailer', e.currentTarget.open)}>
		<summary class="accordion-trigger">
			<span class="section-label">Trailer</span>
			<span class="accordion-hint">{currentTrailer.name}</span>
			<svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
		</summary>
		<div class="accordion-body">
			<p class="trailer-orient-hint">
				<strong>Front-load weight:</strong> put the heaviest items toward the <strong>front</strong> (hitch /
				tow vehicle) in the 3D view so the trailer tracks straight and is less likely to sway.
			</p>
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
	</details>

	{#if result}
		<details class="accordion" open={accordionState.isOpen('pack-load-order')} ontoggle={(e) => accordionState.toggle('pack-load-order', e.currentTarget.open)}>
			<summary class="accordion-trigger">
				<span class="section-label">Load Order</span>
					<span class="accordion-hint">{step === 0 ? `All (${result.placed.length})` : `${step} / ${result.placed.length}`}</span>
					<svg class="accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
				</summary>
				<div class="accordion-body">
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
			</details>

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

	/* Accordion */
	.accordion {
		border: none;
		border-radius: var(--radius-lg);
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

	.trailer-orient-hint {
		font-size: 12px;
		line-height: 1.45;
		color: var(--color-text-secondary);
		margin: 0 0 12px;
		padding: 12px 14px;
		background: var(--color-bg);
		border-radius: var(--radius-md);
		border: none;
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}

	.trailer-orient-hint strong {
		color: var(--color-text-primary);
		font-weight: 600;
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
		border: none;
		border-radius: var(--radius-md);
		text-align: left;
		background: var(--color-bg);
		transition: background 0.2s ease, box-shadow 0.2s ease;
	}

	.preset-btn.active {
		background: var(--color-bg-elevated);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
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

	.pack-stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	.pack-bars {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.cap-bar-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cap-bar-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cap-bar-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.cap-bar-meta {
		font-size: 13px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}

	.cap-bar-meta strong {
		color: var(--color-text-primary);
		font-weight: 600;
	}

	.cap-bar-meta .over {
		color: var(--color-danger);
	}

	.cap-bar-track {
		height: 8px;
		border-radius: 100px;
		background: rgba(255, 255, 255, 0.06);
		border: none;
		overflow: hidden;
	}

	.cap-bar-track.over-cap {
		box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.45);
	}

	.cap-bar-fill {
		height: 100%;
		border-radius: 100px;
		transition: width 0.25s ease;
	}

	.cap-bar-fill.vol {
		background: linear-gradient(90deg, #9a9a9a, #f0f0f0);
	}

	.cap-bar-fill.weight {
		background: linear-gradient(90deg, #22c55e, #4ade80);
	}

	.cap-bar-track.over-cap .cap-bar-fill.weight {
		background: linear-gradient(90deg, var(--color-danger), #f87171);
	}

	.cap-bar-hint {
		font-size: 11px;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.35;
	}

	.pack-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 14px 8px;
		background: var(--color-bg-card);
		border-radius: var(--radius-md);
		border: none;
	}

	.pack-stat-val {
		font-size: 28px;
		font-weight: 700;
		line-height: 1;
	}

	.pack-stat-val.warn {
		color: var(--color-warning);
	}

	.pack-stat-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
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
		border: none;
		border-radius: 50%;
		background: var(--color-bg-card);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		transition: background 0.2s ease;
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
