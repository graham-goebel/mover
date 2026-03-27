<script lang="ts">
	import { fileToDataUrl, compressPhoto } from '$lib/utils/photo';

	interface Props {
		onCapture: (dataUrl: string) => void;
	}

	let { onCapture }: Props = $props();
	let fileInput: HTMLInputElement;
	let loading = $state(false);

	async function handleFile(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		loading = true;
		try {
			const raw = await fileToDataUrl(file);
			const compressed = await compressPhoto(raw);
			onCapture(compressed);
		} finally {
			loading = false;
			target.value = '';
		}
	}
</script>

<div class="camera-capture">
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		capture="environment"
		onchange={handleFile}
		class="sr-only"
	/>

	<button class="capture-btn" onclick={() => fileInput.click()} disabled={loading}>
		{#if loading}
			<div class="spinner"></div>
			<span>Processing…</span>
		{:else}
			<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
				<circle cx="12" cy="13" r="4"/>
			</svg>
			<span>Take Photo</span>
		{/if}
	</button>

	<p class="hint">Place a credit card next to the item for size reference</p>
</div>

<style>
	.camera-capture {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 40px 24px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.capture-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: 160px;
		height: 160px;
		border-radius: 50%;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 15px;
		font-weight: 600;
		justify-content: center;
		transition: transform 0.15s, background 0.15s;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
	}

	.capture-btn:active {
		transform: scale(0.95);
		background: var(--color-accent-hover);
	}

	.capture-btn:disabled {
		opacity: 0.6;
	}

	.hint {
		font-size: 14px;
		color: var(--color-text-muted);
		text-align: center;
		max-width: 260px;
		line-height: 1.5;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border: 3px solid rgba(9, 9, 11, 0.2);
		border-top-color: var(--color-accent-fg);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
