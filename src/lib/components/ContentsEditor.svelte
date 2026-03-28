<script lang="ts">
	import { inventory } from '$lib/stores/inventory';

	interface Props {
		/** When set and not in draft mode, lines are saved to the inventory store. */
		itemId?: string;
		contents: string[];
		/** New item flow: keep lines in parent until the item is created. */
		draft?: boolean;
		onDraftAdd?: (text: string) => void;
		onDraftRemove?: (index: number) => void;
	}

	let { itemId, contents, draft = false, onDraftAdd, onDraftRemove }: Props = $props();
	let newContent = $state('');

	function add() {
		const text = newContent.trim();
		if (!text) return;
		if (draft) {
			onDraftAdd?.(text);
		} else if (itemId) {
			inventory.addContent(itemId, text);
		}
		newContent = '';
	}

	function remove(index: number) {
		if (draft) {
			onDraftRemove?.(index);
		} else if (itemId) {
			inventory.removeContent(itemId, index);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			add();
		}
	}
</script>

<div class="contents-editor">
	<h4 class="section-title">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
		Contents
	</h4>

	{#if contents.length > 0}
		<ul class="contents-list">
			{#each contents as item, i}
				<li class="content-item">
					<span>{item}</span>
					<button class="remove-btn" onclick={() => remove(i)} aria-label="Remove">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">No contents listed yet</p>
	{/if}

	<div class="add-row">
		<input
			type="text"
			placeholder="Add item…"
			bind:value={newContent}
			onkeydown={handleKeydown}
		/>
		<button class="add-btn" onclick={add} disabled={!newContent.trim()}>Add</button>
	</div>
</div>

<style>
	.contents-editor {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.contents-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.content-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--color-bg);
		border-radius: var(--radius-sm);
		font-size: 14px;
	}

	.remove-btn {
		color: var(--color-text-muted);
		padding: 4px;
		border-radius: 4px;
		transition: color 0.15s;
	}

	.remove-btn:active {
		color: var(--color-danger);
	}

	.empty {
		font-size: 13px;
		color: var(--color-text-muted);
		font-style: italic;
		padding: 8px 0;
	}

	.add-row {
		display: flex;
		gap: 8px;
	}

	.add-row input {
		flex: 1;
		font-size: 14px;
		padding: 8px 12px;
	}

	.add-btn {
		padding: 8px 16px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 14px;
		font-weight: 600;
		border-radius: var(--radius-sm);
		white-space: nowrap;
	}

	.add-btn:disabled {
		opacity: 0.4;
	}
</style>
