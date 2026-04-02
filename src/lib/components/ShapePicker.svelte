<script lang="ts">
	import { onMount } from 'svelte';
	import type { ItemShape } from '$lib/types';
	import { SHAPE_OPTIONS } from '$lib/utils/shapes';
	import { getShapePreviews } from '$lib/utils/shapePreviews';

	interface Props {
		value?: ItemShape;
		id?: string;
	}

	let { value = $bindable<ItemShape>('box'), id }: Props = $props();

	let open = $state(false);
	let previews = $state(new Map<string, string>());
	let container: HTMLElement | undefined;

	const selectedOption = $derived(SHAPE_OPTIONS.find((s) => s.value === value));
	const selectedPreview = $derived(previews.get(value ?? 'box'));

	function select(shape: ItemShape) {
		value = shape;
		open = false;
	}

	// Close when clicking outside
	$effect(() => {
		if (!open) return;
		function onDown(e: PointerEvent) {
			if (container && !container.contains(e.target as Node)) open = false;
		}
		document.addEventListener('pointerdown', onDown);
		return () => document.removeEventListener('pointerdown', onDown);
	});

	onMount(async () => {
		previews = await getShapePreviews();
	});
</script>

<div class="shape-picker" bind:this={container}>
	<button
		type="button"
		class="shape-trigger"
		{id}
		onclick={() => (open = !open)}
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		{#if selectedPreview}
			<img src={selectedPreview} alt={selectedOption?.label} class="trigger-thumb" />
		{:else}
			<span class="trigger-emoji">{selectedOption?.icon ?? '📦'}</span>
		{/if}
		<span class="trigger-label">{selectedOption?.label ?? 'Select shape'}</span>
		<svg
			class="chevron"
			class:flipped={open}
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>

	{#if open}
		<div class="dropdown" role="listbox">
			{#each SHAPE_OPTIONS as opt}
				{@const preview = previews.get(opt.value)}
				<button
					type="button"
					class="option"
					class:selected={value === opt.value}
					role="option"
					aria-selected={value === opt.value}
					onclick={() => select(opt.value as ItemShape)}
				>
					{#if preview}
						<img src={preview} alt={opt.label} class="option-thumb" />
					{:else}
						<span class="option-emoji">{opt.icon}</span>
					{/if}
					<span class="option-label">{opt.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.shape-picker {
		position: relative;
		width: 100%;
	}

	.shape-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: var(--color-bg-input, #1c1c1c);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--color-text-primary);
		font-size: 14px;
		font-family: inherit;
		text-align: left;
		transition: border-color 0.15s;
	}

	.shape-trigger:hover {
		border-color: rgba(255, 255, 255, 0.18);
	}

	.trigger-thumb {
		width: 36px;
		height: 36px;
		object-fit: contain;
		flex-shrink: 0;
		border-radius: 4px;
	}

	.trigger-emoji {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		flex-shrink: 0;
	}

	.trigger-label {
		flex: 1;
		font-weight: 500;
	}

	.chevron {
		flex-shrink: 0;
		color: var(--color-text-secondary);
		transition: transform 0.2s;
	}

	.chevron.flipped {
		transform: rotate(180deg);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 60;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
		padding: 6px;
		max-height: 340px;
		overflow-y: auto;
	}

	.option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px 6px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		cursor: pointer;
		color: var(--color-text-secondary);
		font-size: 11px;
		font-family: inherit;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.option:hover {
		background: var(--color-bg-card);
		color: var(--color-text-primary);
	}

	.option.selected {
		background: var(--color-accent-soft);
		color: var(--color-text-primary);
		outline: 1.5px solid var(--color-border-subtle);
	}

	.option-thumb {
		width: 52px;
		height: 52px;
		object-fit: contain;
	}

	.option-emoji {
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 26px;
	}

	.option-label {
		font-weight: 500;
		text-align: center;
		line-height: 1.2;
		font-size: 11px;
	}
</style>
