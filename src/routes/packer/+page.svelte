<script lang="ts">
	import type { PackedItem, TrailerPreset, PackResult } from '$lib/types';
	import { trailer, packResult, loadOrderStep } from '$lib/stores/trailer';
	import PackControls from '$lib/components/PackControls.svelte';
	import TrailerScene from '$lib/components/TrailerScene.svelte';

	let currentTrailer = $state<TrailerPreset>({ name: '', length: 12, width: 6, height: 6.5 });
	let result = $state<PackResult | null>(null);
	let step = $state(0);
	let selectedItemId = $state<string | null>(null);
	let showControls = $state(true);

	trailer.subscribe((v) => currentTrailer = v);
	packResult.subscribe((v) => result = v);
	loadOrderStep.subscribe((v) => step = v);
</script>

<svelte:head>
	<title>Mover — Pack Planner</title>
</svelte:head>

<div class="packer-page">
	<div class="packer-header">
		<h1>Pack Planner</h1>
	</div>

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

	{#if showControls}
		<div class="controls-panel">
			<PackControls />
		</div>
	{/if}
</div>

<style>
	.packer-page {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.packer-header {
		padding: 16px;
		flex-shrink: 0;
	}

	.packer-header h1 {
		font-size: 28px;
		font-weight: 700;
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
		max-height: 50vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		background: var(--color-bg);
		border-top: 1px solid var(--color-border);
	}
</style>
