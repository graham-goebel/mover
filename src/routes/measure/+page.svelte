<script lang="ts">
	import type { Dimensions } from '$lib/types';
	import CameraCapture from '$lib/components/CameraCapture.svelte';
	import MeasurementCanvas from '$lib/components/MeasurementCanvas.svelte';
	import ItemForm from '$lib/components/ItemForm.svelte';

	let photoUrl = $state<string | null>(null);
	let measuredDims = $state<Dimensions | null>(null);
	let finalPhoto = $state<string | null>(null);

	type FlowStep = 'capture' | 'measure' | 'form';
	let flowStep = $state<FlowStep>('capture');

	function handleCapture(dataUrl: string) {
		photoUrl = dataUrl;
		flowStep = 'measure';
	}

	function handleMeasureComplete(dims: Dimensions, photo: string) {
		measuredDims = dims;
		finalPhoto = photo;
		flowStep = 'form';
	}

	function handleMeasureCancel() {
		photoUrl = null;
		flowStep = 'capture';
	}

	function handleFormBack() {
		flowStep = 'measure';
	}

	function handleManualEntry() {
		const placeholder = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#1a1a1a" width="200" height="200"/><text x="50%" y="50%" fill="#737373" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="40">&#x1F4E6;</text></svg>');
		measuredDims = { l: 0, w: 0, h: 0 };
		finalPhoto = placeholder;
		flowStep = 'form';
	}

	function resetFlow() {
		photoUrl = null;
		measuredDims = null;
		finalPhoto = null;
		flowStep = 'capture';
	}
</script>

<svelte:head>
	<title>Mover — Add Item</title>
</svelte:head>

<div class="measure-page">
	{#if flowStep === 'capture'}
		<div class="capture-screen">
			<h2 class="page-title">Add Item</h2>
			<CameraCapture onCapture={handleCapture} />
			<div class="or-divider">
				<span>or</span>
			</div>
			<button class="manual-btn" onclick={handleManualEntry}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Add Manually
			</button>
		</div>
	{:else if flowStep === 'measure' && photoUrl}
		<MeasurementCanvas
			{photoUrl}
			onComplete={handleMeasureComplete}
			onCancel={handleMeasureCancel}
		/>
	{:else if flowStep === 'form' && measuredDims && finalPhoto}
		<ItemForm
			photo={finalPhoto}
			dimensions={measuredDims}
			onBack={handleFormBack}
		/>
	{/if}
</div>

<style>
	.measure-page {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.capture-screen {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.page-title {
		font-size: 28px;
		font-weight: 700;
		margin-bottom: 8px;
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
		border: none;
		border-radius: var(--radius-lg);
		background: var(--color-bg-card);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		transition: background 0.2s ease;
	}

	.manual-btn:active {
		background: var(--color-bg-elevated);
	}
</style>
