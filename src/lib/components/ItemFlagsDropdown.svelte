<script lang="ts">
	interface Props {
		forSale?: boolean;
		fragile?: boolean;
		stackable?: boolean;
		donate?: boolean;
		important?: boolean;
		fieldId?: string;
	}

	let {
		forSale = $bindable(false),
		fragile = $bindable(false),
		stackable = $bindable(true),
		donate = $bindable(false),
		important = $bindable(false),
		fieldId = 'item-flags'
	}: Props = $props();

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | undefined>(undefined);

	const summary = $derived.by(() => {
		const parts: string[] = [];
		if (important) parts.push('⭐ Important');
		if (forSale) parts.push('For sale');
		if (fragile) parts.push('Fragile');
		parts.push(stackable ? 'Stackable' : 'Not stackable');
		if (donate) parts.push('Donate');
		return parts.join(' · ');
	});

	function toggleOpen(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	$effect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (rootEl && !rootEl.contains(t)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		const id = requestAnimationFrame(() => {
			document.addEventListener('click', onDoc, true);
		});
		document.addEventListener('keydown', onKey);
		return () => {
			cancelAnimationFrame(id);
			document.removeEventListener('click', onDoc, true);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="flags-root" bind:this={rootEl}>
	<span class="field-label" id="{fieldId}-label">Item tags</span>
	<button
		type="button"
		class="flags-trigger"
		aria-expanded={open}
		aria-haspopup="true"
		aria-controls="{fieldId}-panel"
		aria-labelledby="{fieldId}-label"
		onclick={toggleOpen}
	>
		<span class="flags-summary">{summary}</span>
		<svg
			class="chevron"
			class:open
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>

	{#if open}
		<div
			id="{fieldId}-panel"
			class="flags-panel"
			role="group"
			aria-labelledby="{fieldId}-label"
		>
			<label class="flags-option">
				<input type="checkbox" bind:checked={important} />
				<span>⭐ Important</span>
			</label>
			<label class="flags-option">
				<input type="checkbox" bind:checked={forSale} />
				<span>For sale</span>
			</label>
			<label class="flags-option">
				<input type="checkbox" bind:checked={fragile} />
				<span>Fragile</span>
			</label>
			<label class="flags-option">
				<input type="checkbox" bind:checked={stackable} />
				<span>Stackable</span>
			</label>
			<label class="flags-option">
				<input type="checkbox" bind:checked={donate} />
				<span>Donate</span>
			</label>
		</div>
	{/if}
</div>

<style>
	.flags-root {
		position: relative;
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

	.flags-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 14px 16px;
		text-align: left;
		font-size: 14px;
		font-weight: 500;
		color: var(--color-text-primary);
		background: var(--color-bg-card);
		border: none;
		border-radius: var(--radius-lg);
		cursor: pointer;
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		transition: background 0.2s ease, box-shadow 0.2s ease;
	}

	.flags-trigger:hover {
		background: var(--color-bg-elevated);
	}

	.flags-summary {
		flex: 1;
		min-width: 0;
		line-height: 1.35;
	}

	.chevron {
		flex-shrink: 0;
		color: var(--color-text-muted);
		transition: transform 0.2s;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.flags-panel {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 6px);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px;
		background: var(--color-bg-elevated);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow:
			0 0 0 1px var(--color-border-subtle),
			0 12px 40px rgba(0, 0, 0, 0.4);
	}

	.flags-option {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		font-size: 15px;
		cursor: pointer;
		user-select: none;
	}

	.flags-option:hover {
		background: var(--color-bg-card);
	}

	.flags-option input {
		width: 18px;
		height: 18px;
		accent-color: var(--color-accent);
		cursor: pointer;
	}
</style>
