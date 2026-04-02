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

	const tags = $derived([
		{ key: 'important', label: 'Important', icon: '⭐', active: important, toggle: () => (important = !important) },
		{ key: 'fragile',   label: 'Fragile',   icon: '⚠️', active: fragile,   toggle: () => (fragile   = !fragile)   },
		{ key: 'stackable', label: 'Stackable', icon: '📚', active: stackable, toggle: () => (stackable = !stackable) },
		{ key: 'forSale',   label: 'For sale',  icon: '🏷️', active: forSale,   toggle: () => (forSale   = !forSale)   },
		{ key: 'donate',    label: 'Donate',    icon: '🎁', active: donate,    toggle: () => (donate    = !donate)    },
	]);
</script>

<div class="flags-field">
	<span class="field-label" id="{fieldId}-label">Item tags</span>
	<div class="tag-strip" role="group" aria-labelledby="{fieldId}-label">
		{#each tags as tag (tag.key)}
			<button
				type="button"
				class="tag-chip"
				class:active={tag.active}
				onclick={tag.toggle}
				aria-pressed={tag.active}
			>
				<span class="tag-icon">{tag.icon}</span>
				<span class="tag-label">{tag.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.flags-field {
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

	.tag-strip {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding-bottom: 2px;
	}

	.tag-strip::-webkit-scrollbar {
		display: none;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 7px 12px;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 13px;
		font-weight: 500;
		font-family: inherit;
		white-space: nowrap;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.tag-chip:hover {
		border-color: rgba(255, 255, 255, 0.2);
		color: var(--color-text-primary);
	}

	.tag-chip.active {
		background: var(--color-accent-soft);
		border-color: var(--color-accent);
		color: var(--color-text-primary);
	}

	.tag-icon {
		font-size: 14px;
		line-height: 1;
	}
</style>
